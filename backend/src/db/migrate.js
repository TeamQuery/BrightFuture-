import pool from './index.js';

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users / Auth
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin','teacher','parent','librarian','accountant')),
        avatar VARCHAR(500),
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Classes / Grade levels
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        grade_level VARCHAR(50) NOT NULL,
        section VARCHAR(10),
        capacity INT DEFAULT 30,
        room VARCHAR(50),
        teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
        academic_year VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Students
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(20),
        address TEXT,
        photo VARCHAR(500),
        class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
        enrollment_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','inactive','graduated','transferred')),
        blood_group VARCHAR(10),
        medical_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Parents
    await client.query(`
      CREATE TABLE IF NOT EXISTS parents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        occupation VARCHAR(100),
        address TEXT,
        relationship VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Student-Parent relationship
    await client.query(`
      CREATE TABLE IF NOT EXISTS student_parents (
        student_id UUID REFERENCES students(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES parents(id) ON DELETE CASCADE,
        PRIMARY KEY (student_id, parent_id)
      );
    `);

    // Subjects
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        description TEXT,
        grade_level VARCHAR(50),
        credits INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Timetable
    await client.query(`
      CREATE TABLE IF NOT EXISTS timetable (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
        day_of_week VARCHAR(20) NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        room VARCHAR(50),
        academic_year VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Attendance
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id) ON DELETE CASCADE,
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','late','excused')),
        notes TEXT,
        marked_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, date)
      );
    `);

    // Exams
    await client.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
        exam_date DATE NOT NULL,
        total_marks INT NOT NULL,
        passing_marks INT,
        exam_type VARCHAR(50) CHECK (exam_type IN ('quiz','midterm','final','assignment','project')),
        academic_year VARCHAR(20),
        term VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Grades / Results
    await client.query(`
      CREATE TABLE IF NOT EXISTS grades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id) ON DELETE CASCADE,
        exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
        marks_obtained DECIMAL(5,2),
        grade_letter VARCHAR(5),
        remarks TEXT,
        graded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, exam_id)
      );
    `);

    // Fee categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        amount DECIMAL(10,2) NOT NULL,
        frequency VARCHAR(50) CHECK (frequency IN ('one-time','monthly','termly','annual')),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Fee payments
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES students(id) ON DELETE CASCADE,
        category_id UUID REFERENCES fee_categories(id),
        amount_paid DECIMAL(10,2) NOT NULL,
        payment_date DATE DEFAULT CURRENT_DATE,
        payment_method VARCHAR(50) CHECK (payment_method IN ('cash','bank_transfer','mobile_money','card')),
        reference_number VARCHAR(100),
        academic_year VARCHAR(20),
        term VARCHAR(20),
        status VARCHAR(50) DEFAULT 'paid' CHECK (status IN ('paid','pending','partial','waived')),
        notes TEXT,
        received_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Library books
    await client.query(`
      CREATE TABLE IF NOT EXISTS library_books (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(300) NOT NULL,
        author VARCHAR(200),
        isbn VARCHAR(50) UNIQUE,
        category VARCHAR(100),
        publisher VARCHAR(200),
        publish_year INT,
        total_copies INT DEFAULT 1,
        available_copies INT DEFAULT 1,
        location VARCHAR(100),
        description TEXT,
        cover_image VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Book borrowings
    await client.query(`
      CREATE TABLE IF NOT EXISTS book_borrowings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        book_id UUID REFERENCES library_books(id) ON DELETE CASCADE,
        borrower_type VARCHAR(20) CHECK (borrower_type IN ('student','teacher')),
        borrower_id UUID NOT NULL,
        borrow_date DATE DEFAULT CURRENT_DATE,
        due_date DATE NOT NULL,
        return_date DATE,
        status VARCHAR(20) DEFAULT 'borrowed' CHECK (status IN ('borrowed','returned','overdue')),
        fine_amount DECIMAL(8,2) DEFAULT 0,
        issued_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Events / Announcements
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        end_date DATE,
        event_type VARCHAR(50) CHECK (event_type IN ('academic','sports','cultural','holiday','exam','meeting','other')),
        target_audience VARCHAR(50) DEFAULT 'all',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        target_role VARCHAR(50),
        target_user UUID REFERENCES users(id),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('✅ All tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
};

createTables();
