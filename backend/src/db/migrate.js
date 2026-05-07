import { closePostgresPool } from './index.js';
import pool from './index.js';
import { logger } from '../lib/logger.js';

// Helper: creates a trigger only if it doesn't already exist
function createTriggerSQL(triggerName, tableName) {
  return `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = '${triggerName}'
      ) THEN
        CREATE TRIGGER ${triggerName}
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
      END IF;
    END
    $$;
  `;
}

async function migrate() {
  const client = await pool.connect();

  try {
    // Drop all existing tables and types to allow clean migration
    // (outside transaction to avoid constraint issues)
    await client.query(`DROP TABLE IF EXISTS salary_payments CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS teacher_salaries CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS payments CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS student_fees CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS finance_fee_categories CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS library_borrowings CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS library_books CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS student_parents CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS parents CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS attendance CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS grades CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS exams CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS students CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS classes CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS teachers CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS audit_logs CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS users CASCADE;`);
    await client.query(`DROP TYPE IF EXISTS user_role CASCADE;`);

    await client.query('BEGIN');

    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'parent', 'librarian', 'accountant');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_row_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // ─── users ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        email VARCHAR(320) NOT NULL,
        password_hash TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'parent',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('users_set_updated_at', 'users'));

    // ─── audit_logs ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        request_id UUID NOT NULL,
        actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id UUID,
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        ip_address INET,
        user_agent TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // users indexes
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_active_idx
      ON users (LOWER(email))
      WHERE deleted_at IS NULL;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS users_role_active_idx ON users (role) WHERE deleted_at IS NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS users_last_login_idx ON users (last_login_at DESC);`);

    // audit_logs indexes
    await client.query(`CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx ON audit_logs (actor_user_id, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_logs_target_created_idx ON audit_logs (target_user_id, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx ON audit_logs (action, created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx ON audit_logs (request_id);`);

    // ─── teachers ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS teachers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(320) UNIQUE NOT NULL,
        phone VARCHAR(20),
        date_of_birth DATE,
        gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
        address TEXT,
        qualification VARCHAR(200),
        specialization VARCHAR(100),
        hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
        salary DECIMAL(10,2),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('teachers_set_updated_at', 'teachers'));

    // ─── classes ──────────────────────────────────────────────────────────────
    // Must come before students (students.class_id references classes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        grade_level INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
        capacity INTEGER DEFAULT 30,
        room VARCHAR(50),
        teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
        academic_year VARCHAR(20) NOT NULL DEFAULT '2024/2025',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(name, academic_year)
      );
    `);

    await client.query(createTriggerSQL('classes_set_updated_at', 'classes'));

    // ─── students ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        student_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
        address TEXT,
        enrollment_date DATE DEFAULT CURRENT_DATE,
        grade_level INTEGER CHECK (grade_level >= 1 AND grade_level <= 12),
        class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
        blood_group VARCHAR(10) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
        medical_info TEXT,
        emergency_contact VARCHAR(200),
        is_active BOOLEAN DEFAULT true,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('students_set_updated_at', 'students'));

    // ─── subjects ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        description TEXT,
        grade_level INTEGER CHECK (grade_level >= 1 AND grade_level <= 12),
        credits DECIMAL(3,1) DEFAULT 1.0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('subjects_set_updated_at', 'subjects'));

    // ─── grades ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS grades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        grade VARCHAR(5) NOT NULL CHECK (grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F')),
        term VARCHAR(20) NOT NULL DEFAULT 'Term 1' CHECK (term IN ('Term 1', 'Term 2', 'Term 3')),
        comments TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('grades_set_updated_at', 'grades'));

    // ─── attendance ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
        notes TEXT,
        marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('attendance_set_updated_at', 'attendance'));

    // ─── parents ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS parents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(320) UNIQUE,
        phone VARCHAR(20),
        address TEXT,
        occupation VARCHAR(100),
        relationship VARCHAR(50) DEFAULT 'parent' CHECK (relationship IN ('father', 'mother', 'guardian', 'parent')),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('parents_set_updated_at', 'parents'));

    // ─── student_parents ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_parents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
        relationship VARCHAR(50) DEFAULT 'parent' CHECK (relationship IN ('father', 'mother', 'guardian', 'parent')),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(student_id, parent_id)
      );
    `);

    await client.query(createTriggerSQL('student_parents_set_updated_at', 'student_parents'));

    // ─── library_books ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS library_books (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        isbn VARCHAR(20) UNIQUE,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        publisher VARCHAR(255),
        publication_year INTEGER CHECK (publication_year >= 1000 AND publication_year <= EXTRACT(YEAR FROM NOW()) + 1),
        total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies > 0),
        available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0 AND available_copies <= total_copies),
        location VARCHAR(100) DEFAULT 'Main Library',
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('library_books_set_updated_at', 'library_books'));

    // ─── library_borrowings ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS library_borrowings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
        borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
        due_date DATE NOT NULL,
        return_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
        notes TEXT,
        issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
        returned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('library_borrowings_set_updated_at', 'library_borrowings'));

    // ─── finance_fee_categories ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS finance_fee_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
        frequency VARCHAR(20) NOT NULL DEFAULT 'annual' CHECK (frequency IN ('one-time', 'monthly', 'quarterly', 'semi-annual', 'annual')),
        grade_level INTEGER CHECK (grade_level >= 1 AND grade_level <= 12),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('finance_fee_categories_set_updated_at', 'finance_fee_categories'));

    // ─── student_fees ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_fees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        fee_category_id UUID NOT NULL REFERENCES finance_fee_categories(id) ON DELETE CASCADE,
        academic_year VARCHAR(9) NOT NULL,
        amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
        due_date DATE NOT NULL,
        paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'waived')),
        discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= amount),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(student_id, fee_category_id, academic_year)
      );
    `);

    await client.query(createTriggerSQL('student_fees_set_updated_at', 'student_fees'));

    // ─── payments ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'credit_card', 'debit_card', 'online', 'scholarship', 'other')),
        transaction_id VARCHAR(100) UNIQUE,
        received_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(createTriggerSQL('payments_set_updated_at', 'payments'));

    // ─── teacher_salaries ─────────────────────────────────────────────────────
    // FIX: added UNIQUE(teacher_id, effective_date) so seed ON CONFLICT works
    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_salaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        base_salary DECIMAL(10,2) NOT NULL CHECK (base_salary > 0),
        allowances DECIMAL(10,2) DEFAULT 0 CHECK (allowances >= 0),
        deductions DECIMAL(10,2) DEFAULT 0 CHECK (deductions >= 0),
        effective_date DATE NOT NULL,
        end_date DATE CHECK (end_date IS NULL OR end_date > effective_date),
        payment_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('weekly', 'bi-weekly', 'monthly', 'annual')),
        currency VARCHAR(3) NOT NULL DEFAULT 'GHS',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(teacher_id, effective_date)
      );
    `);

    await client.query(createTriggerSQL('teacher_salaries_set_updated_at', 'teacher_salaries'));

    // ─── salary_payments ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS salary_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_salary_id UUID NOT NULL REFERENCES teacher_salaries(id) ON DELETE CASCADE,
        payment_period_start DATE NOT NULL,
        payment_period_end DATE NOT NULL,
        gross_amount DECIMAL(10,2) NOT NULL CHECK (gross_amount > 0),
        net_amount DECIMAL(10,2) NOT NULL CHECK (net_amount > 0 AND net_amount <= gross_amount),
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'direct_deposit', 'other')),
        transaction_id VARCHAR(100) UNIQUE,
        processed_by UUID REFERENCES users(id),
        additional_deductions DECIMAL(10,2) DEFAULT 0 CHECK (additional_deductions >= 0),
        additional_allowances DECIMAL(10,2) DEFAULT 0 CHECK (additional_allowances >= 0),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (payment_period_end >= payment_period_start)
      );
    `);

    await client.query(createTriggerSQL('salary_payments_set_updated_at', 'salary_payments'));

    // ─── indexes ──────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_finance_fee_categories_active ON finance_fee_categories(is_active);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_finance_fee_categories_grade_level ON finance_fee_categories(grade_level);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON student_fees(student_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_fee_category_id ON student_fees(fee_category_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_academic_year ON student_fees(academic_year);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_status ON student_fees(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_due_date ON student_fees(due_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_student_fee_id ON payments(student_fee_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_received_by ON payments(received_by);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher_salaries_teacher_id ON teacher_salaries(teacher_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher_salaries_is_active ON teacher_salaries(is_active);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher_salaries_effective_date ON teacher_salaries(effective_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_salary_payments_teacher_salary_id ON salary_payments(teacher_salary_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_salary_payments_payment_date ON salary_payments(payment_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_salary_payments_processed_by ON salary_payments(processed_by);`);

    await client.query('COMMIT');
    logger.info('Database migration completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error({ error }, 'Database migration failed.');
    process.exitCode = 1;
  } finally {
    client.release();
    await closePostgresPool();
  }
}

migrate();


// import { closePostgresPool } from './index.js';
// import pool from './index.js';
// import { logger } from '../lib/logger.js';

// async function migrate() {
//   const client = await pool.connect();

//   try {
//     await client.query('BEGIN');

//     await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

//     await client.query(`
//       DO $$
//       BEGIN
//         CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'parent', 'librarian', 'accountant');
//       EXCEPTION
//         WHEN duplicate_object THEN NULL;
//       END
//       $$;
//     `);

//     await client.query(`
//       CREATE OR REPLACE FUNCTION set_row_updated_at()
//       RETURNS TRIGGER AS $$
//       BEGIN
//         NEW.updated_at = NOW();
//         RETURN NEW;
//       END;
//       $$ LANGUAGE plpgsql;
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS users (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         name VARCHAR(120) NOT NULL,
//         email VARCHAR(320) NOT NULL,
//         password_hash TEXT NOT NULL,
//         role user_role NOT NULL DEFAULT 'parent',
//         is_active BOOLEAN NOT NULL DEFAULT true,
//         last_login_at TIMESTAMPTZ,
//         deleted_at TIMESTAMPTZ,
//         deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       DO $$
//       BEGIN
//         IF NOT EXISTS (
//           SELECT 1
//           FROM pg_trigger
//           WHERE tgname = 'users_set_updated_at'
//         ) THEN
//           CREATE TRIGGER users_set_updated_at
//           BEFORE UPDATE ON users
//           FOR EACH ROW
//           EXECUTE FUNCTION set_row_updated_at();
//         END IF;
//       END
//       $$;
//     `);

//     await client.query(`
//       CREATE TABLE IF NOT EXISTS audit_logs (
//         id BIGSERIAL PRIMARY KEY,
//         request_id UUID NOT NULL,
//         actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
//         target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
//         action VARCHAR(100) NOT NULL,
//         resource_type VARCHAR(100) NOT NULL,
//         resource_id UUID,
//         status VARCHAR(20) NOT NULL DEFAULT 'success',
//         ip_address INET,
//         user_agent TEXT,
//         metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     // Index strategy:
//     // 1. Partial unique index keeps active emails unique while supporting soft delete.
//     // 2. Role and login indexes support frequent auth/admin lookups.
//     // 3. Audit indexes favor recent chronological investigations by actor, target, and action.
//     await client.query(`
//       CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_active_idx
//       ON users (LOWER(email))
//       WHERE deleted_at IS NULL;
//     `);

//     await client.query(`
//       CREATE INDEX IF NOT EXISTS users_role_active_idx
//       ON users (role)
//       WHERE deleted_at IS NULL;
//     `);

//     await client.query(`
//       CREATE INDEX IF NOT EXISTS users_last_login_idx
//       ON users (last_login_at DESC);
//     `);

//     await client.query(`
//       CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
//       ON audit_logs (actor_user_id, created_at DESC);
//     `);

//     await client.query(`
//       CREATE INDEX IF NOT EXISTS audit_logs_target_created_idx
//       ON audit_logs (target_user_id, created_at DESC);
//     `);

//     await client.query(`
//       CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
//       ON audit_logs (action, created_at DESC);
//     `);

//     await client.query(`
//       CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx
//       ON audit_logs (request_id);
//     `);

//     // Students table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS students (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         student_id VARCHAR(50) UNIQUE NOT NULL,
//         first_name VARCHAR(100) NOT NULL,
//         last_name VARCHAR(100) NOT NULL,
//         date_of_birth DATE NOT NULL,
//         gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
//         address TEXT,
//         class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
//         blood_group VARCHAR(10) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
//         medical_notes TEXT,
//         status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER students_set_updated_at
//       BEFORE UPDATE ON students
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Classes table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS classes (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         name VARCHAR(100) NOT NULL,
//         grade_level INTEGER NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
//         section VARCHAR(10) NOT NULL DEFAULT 'A',
//         capacity INTEGER DEFAULT 30,
//         room VARCHAR(50),
//         teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
//         academic_year VARCHAR(20) NOT NULL DEFAULT '2024/2025',
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER classes_set_updated_at
//       BEFORE UPDATE ON classes
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Subjects table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS subjects (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         name VARCHAR(100) NOT NULL,
//         code VARCHAR(20) UNIQUE NOT NULL,
//         description TEXT,
//         grade_level INTEGER CHECK (grade_level >= 1 AND grade_level <= 12),
//         credits DECIMAL(3,1) DEFAULT 1.0,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER subjects_set_updated_at
//       BEFORE UPDATE ON subjects
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Grades table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS grades (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
//         subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
//         class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
//         grade VARCHAR(5) NOT NULL CHECK (grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F')),
//         term VARCHAR(20) NOT NULL DEFAULT 'Term 1' CHECK (term IN ('Term 1', 'Term 2', 'Term 3')),
//         comments TEXT,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER grades_set_updated_at
//       BEFORE UPDATE ON grades
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Attendance table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS attendance (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
//         class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
//         date DATE NOT NULL,
//         status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
//         notes TEXT,
//         marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER attendance_set_updated_at
//       BEFORE UPDATE ON attendance
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Parents table (guardians/parents are users with role 'parent', but we need additional info)
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS parents (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
//         phone VARCHAR(20),
//         occupation VARCHAR(100),
//         relationship VARCHAR(50) DEFAULT 'parent' CHECK (relationship IN ('father', 'mother', 'guardian', 'parent')),
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER parents_set_updated_at
//       BEFORE UPDATE ON parents
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Student-Parent relationship (many-to-many, since a student can have multiple parents/guardians, and parents can have multiple children)
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS student_parents (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
//         parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
//         relationship VARCHAR(50) DEFAULT 'parent' CHECK (relationship IN ('father', 'mother', 'guardian', 'parent')),
//         is_primary BOOLEAN DEFAULT false,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER student_parents_set_updated_at
//       BEFORE UPDATE ON student_parents
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Library Books table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS library_books (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         title VARCHAR(255) NOT NULL,
//         author VARCHAR(255) NOT NULL,
//         isbn VARCHAR(20) UNIQUE,
//         category VARCHAR(100) NOT NULL DEFAULT 'General',
//         publisher VARCHAR(255),
//         publication_year INTEGER CHECK (publication_year >= 1000 AND publication_year <= EXTRACT(YEAR FROM NOW()) + 1),
//         total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies > 0),
//         available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0 AND available_copies <= total_copies),
//         location VARCHAR(100) DEFAULT 'Main Library',
//         description TEXT,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER library_books_set_updated_at
//       BEFORE UPDATE ON library_books
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Library Borrowings table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS library_borrowings (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         book_id UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
//         borrower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Can be student, teacher, parent, etc.
//         borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
//         due_date DATE NOT NULL,
//         return_date DATE,
//         status VARCHAR(20) NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
//         notes TEXT,
//         issued_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Librarian who issued the book
//         returned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Librarian who received the return
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER library_borrowings_set_updated_at
//       BEFORE UPDATE ON library_borrowings
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Finance Fee Categories table
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS finance_fee_categories (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         name VARCHAR(100) NOT NULL UNIQUE,
//         description TEXT,
//         amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
//         frequency VARCHAR(20) NOT NULL DEFAULT 'annual' CHECK (frequency IN ('one-time', 'monthly', 'quarterly', 'semi-annual', 'annual')),
//         grade_level INTEGER CHECK (grade_level >= 1 AND grade_level <= 12), -- NULL means applies to all grades
//         is_active BOOLEAN NOT NULL DEFAULT true,
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER finance_fee_categories_set_updated_at
//       BEFORE UPDATE ON finance_fee_categories
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Student Fees table (junction between students and fee categories with payment tracking)
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS student_fees (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
//         fee_category_id UUID NOT NULL REFERENCES finance_fee_categories(id) ON DELETE CASCADE,
//         academic_year VARCHAR(9) NOT NULL, -- e.g., '2024-2025'
//         amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- Amount at time of assignment (may differ from category amount due to adjustments)
//         due_date DATE NOT NULL,
//         paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount), -- Track partial payments
//         status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'waived')),
//         discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= amount), -- Scholarship or discount applied
//         notes TEXT, -- Payment notes or special arrangements
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         UNIQUE(student_id, fee_category_id, academic_year) -- Prevent duplicate fee assignments per year
//       );
//       BEFORE UPDATE ON student_fees
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Payments table (tracks individual payment transactions for student fees)
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS payments (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE, -- Links to specific fee assignment
//         amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- Amount of this specific payment
//         payment_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date payment was made/received
//         payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'credit_card', 'debit_card', 'online', 'scholarship', 'other')),
//         transaction_id VARCHAR(100) UNIQUE, -- Bank transaction ID or receipt number for tracking
//         received_by UUID REFERENCES users(id), -- Staff member who recorded the payment (NULL for automated payments)
//         notes TEXT, -- Additional payment details or reference numbers
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
//       );
//     `);

//     await client.query(`
//       CREATE TRIGGER payments_set_updated_at
//       BEFORE UPDATE ON payments
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Teacher Salaries table (tracks salary information for teachers/staff with payment history)
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS teacher_salaries (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Links to teacher record (which links to user account via user_id)
//         base_salary DECIMAL(10,2) NOT NULL CHECK (base_salary > 0), -- Monthly base salary amount
//         allowances DECIMAL(10,2) DEFAULT 0 CHECK (allowances >= 0), -- Additional allowances (housing, transport, etc.)
//         deductions DECIMAL(10,2) DEFAULT 0 CHECK (deductions >= 0), -- Standard deductions (tax, insurance, etc.)
//         effective_date DATE NOT NULL, -- When this salary structure became effective
//         end_date DATE, -- When this salary structure ended (NULL means current/active salary structure) CHECK (end_date IS NULL OR end_date > effective_date)
//         payment_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('weekly', 'bi-weekly', 'monthly', 'annual')),
//         currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- Currency code (USD, EUR, etc.)
//         is_active BOOLEAN NOT NULL DEFAULT true, -- Whether this salary structure is currently active
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//     await client.query(`
//       CREATE TRIGGER teacher_salaries_set_updated_at
//       BEFORE UPDATE ON teacher_salaries
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Salary Payments table (tracks individual salary payment transactions for teachers/staff)
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS salary_payments (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         teacher_salary_id UUID NOT NULL REFERENCES teacher_salaries(id) ON DELETE CASCADE, -- Links to salary structure
//         payment_period_start DATE NOT NULL, -- Start date of payment period (e.g., month start for monthly salary)
//         payment_period_end DATE NOT NULL, -- End date of payment period (e.g., month end for monthly salary) CHECK (payment_period_end >= payment_period_start)
//         gross_amount DECIMAL(10,2) NOT NULL CHECK (gross_amount > 0), -- Total gross salary for this period (base + allowances - deductions from salary structure at time of payment)
//         net_amount DECIMAL(10,2) NOT NULL CHECK (net_amount > 0 AND net_amount <= gross_amount), -- Net amount after additional deductions (taxes, etc. calculated at payment time) CHECK (net_amount <= gross_amount)
//         payment_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date salary was paid
//         payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'direct_deposit', 'other')),
//         transaction_id VARCHAR(100) UNIQUE, -- Bank transaction ID or check number for tracking
//         processed_by UUID REFERENCES users(id), -- Admin/staff member who processed the payment (NULL for automated payments) CHECK (processed_by IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = processed_by AND role IN ('admin', 'accountant')))
//         additional_deductions DECIMAL(10,2) DEFAULT 0 CHECK (additional_deductions >= 0), -- Extra deductions applied at payment time (loans, advances, etc.)
//         additional_allowances DECIMAL(10,2) DEFAULT 0 CHECK (additional_allowances >= 0), -- Extra allowances applied at payment time (bonuses, overtime, etc.)
//         notes TEXT, -- Payment notes or special arrangements
//         created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//         CHECK (payment_period_end >= payment_period_start), -- Ensure payment period is valid
//     await client.query(`
//       CREATE TRIGGER salary_payments_set_updated_at
//       BEFORE UPDATE ON salary_payments
//       FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
//     `);

//     // Indexes for performance on new tables
//     // Finance indexes
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_finance_fee_categories_active ON finance_fee_categories(is_active);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_finance_fee_categories_grade_level ON finance_fee_categories(grade_level);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON student_fees(student_id);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_fee_category_id ON student_fees(fee_category_id);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_academic_year ON student_fees(academic_year);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_status ON student_fees(status);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_student_fees_due_date ON student_fees(due_date);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_student_fee_id ON payments(student_fee_id);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_payments_received_by ON payments(received_by);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher_salaries_teacher_id ON teacher_salaries(teacher_id);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher_salaries_is_active ON teacher_salaries(is_active);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_teacher_salaries_effective_date ON teacher_salaries(effective_date);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_salary_payments_teacher_salary_id ON salary_payments(teacher_salary_id);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_salary_payments_payment_date ON salary_payments(payment_date);`);
//     await client.query(`CREATE INDEX IF NOT EXISTS idx_salary_payments_processed_by ON salary_payments(processed_by);`);

//     await client.query('COMMIT');
//     logger.info('Database migration completed successfully.');
//   } catch (error) {
//     await client.query('ROLLBACK');
//     logger.error({ error }, 'Database migration failed.');
//     process.exitCode = 1;
//   } finally {
//     client.release();
//     await closePostgresPool();
//   }
// }

// migrate();
