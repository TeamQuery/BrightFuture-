import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { closePostgresPool, withTransaction } from './index.js';
import { logger } from '../lib/logger.js';
import { strongPasswordSchema } from '../routes/auth.schemas.js';
import { insertAuditLog } from '../repositories/audit-repository.js';
import { findUserByEmail } from '../repositories/user-repository.js';
import { hashPassword, normalizeEmail } from '../lib/security.js';

const demoAccountPassword =
  process.env.ACCOUNTS_PASSWORD ?? process.env.DEMO_ACCOUNT_PASSWORD ?? 'password1234';

const demoAccounts = [
  {
    name: process.env.ADMIN_NAME ?? process.env.DEMO_ADMIN_NAME ?? 'BrightFuture Administrator',
    email: process.env.ADMIN_EMAIL ?? process.env.DEMO_ADMIN_EMAIL ?? 'admin@brightfuture.edu.gh',
    role: 'admin',
  },
  {
    name: process.env.TEACHER_NAME ?? process.env.DEMO_TEACHER_NAME ?? 'Abena Mensah',
    email: process.env.TEACHER_EMAIL ?? process.env.DEMO_TEACHER_EMAIL ?? 'abena.mensah@brightfuture.edu.gh',
    role: 'teacher',
  },
  {
    name: process.env.PARENT_NAME ?? process.env.DEMO_PARENT_NAME ?? 'Grace Tetteh',
    email: process.env.PARENT_EMAIL ?? process.env.DEMO_PARENT_EMAIL ?? 'grace.tetteh@brightfuture.edu.gh',
    role: 'parent',
  },
  {
    name: process.env.LIBRARIAN_NAME ?? process.env.DEMO_LIBRARIAN_NAME ?? 'Akua Sarpong',
    email: process.env.LIBRARIAN_EMAIL ?? process.env.DEMO_LIBRARIAN_EMAIL ?? 'akua.sarpong@brightfuture.edu.gh',
    role: 'librarian',
  },
  {
    name: process.env.ACCOUNTANT_NAME ?? process.env.DEMO_ACCOUNTANT_NAME ?? 'Yaw Ofori',
    email: process.env.ACCOUNTANT_EMAIL ?? process.env.DEMO_ACCOUNTANT_EMAIL ?? 'yaw.ofori@brightfuture.edu.gh',
    role: 'accountant',
  },
];

const bootstrapSchema = z.object({
  ADMIN_BOOTSTRAP_NAME: z.string().trim().min(2),
  ADMIN_BOOTSTRAP_EMAIL: z.string().trim().email(),
  ADMIN_BOOTSTRAP_PASSWORD: strongPasswordSchema,
});

function mapStaffRole(staffRole, title, jobTitle) {
  const value = `${staffRole ?? ''} ${title ?? ''} ${jobTitle ?? ''}`.toLowerCase();

  if (value.includes('librarian') || value.includes('library')) {
    return 'librarian';
  }

  if (
    value.includes('accountant') ||
    value.includes('account') ||
    value.includes('finance') ||
    value.includes('bursar')
  ) {
    return 'accountant';
  }

  if (value.includes('admin')) {
    return 'admin';
  }

  return 'teacher';
}

function formatStaffName(staff) {
  return [staff.first_name, staff.middle_name, staff.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function loadPortalSourceAccounts(client) {
  const relationResult = await client.query(
    `
      SELECT
        to_regclass('staff.tbl_staff') IS NOT NULL AS "hasStaff",
        to_regclass('students.tbl_guardians') IS NOT NULL AS "hasGuardians"
    `,
  );
  const { hasStaff, hasGuardians } = relationResult.rows[0];
  const accounts = [];

  if (hasStaff) {
    const staffResult = await client.query(`
      SELECT first_name, middle_name, last_name, email, role, title, job_title
      FROM staff.tbl_staff
      WHERE email IS NOT NULL
        AND btrim(email) <> ''
        AND COALESCE(is_archived, false) = false
    `);

    accounts.push(
      ...staffResult.rows.map((staff) => ({
        name: formatStaffName(staff) || staff.email,
        email: staff.email,
        role: mapStaffRole(staff.role, staff.title, staff.job_title),
      })),
    );
  }

  if (hasGuardians) {
    const guardianResult = await client.query(`
      SELECT full_name, email
      FROM students.tbl_guardians
      WHERE email IS NOT NULL
        AND btrim(email) <> ''
    `);

    accounts.push(
      ...guardianResult.rows.map((guardian) => ({
        name: guardian.full_name || guardian.email,
        email: guardian.email,
        role: 'parent',
      })),
    );
  }

  return accounts;
}

async function upsertUserAccount(account, passwordHash, client) {
  const email = normalizeEmail(account.email);
  const existingUser = await findUserByEmail(email, client);

  if (existingUser) {
    const result = await client.query(
      `
        UPDATE users
        SET name = $1,
            email = $2,
            password_hash = $3,
            role = $4,
            is_active = true,
            deleted_at = NULL,
            deleted_by = NULL,
            updated_at = NOW()
        WHERE id = $5
        RETURNING id, email, role
      `,
      [account.name, email, passwordHash, account.role, existingUser.id],
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING id, email, role
    `,
    [account.name, email, passwordHash, account.role],
  );

  return result.rows[0];
}

async function seedPortalAccounts() {
  const seededUsers = await withTransaction(async (client) => {
    const sourceAccounts = await loadPortalSourceAccounts(client);
    const accountsByEmail = new Map();

    for (const account of [...sourceAccounts, ...demoAccounts]) {
      if (!account.email || !account.name) {
        continue;
      }

      accountsByEmail.set(normalizeEmail(account.email), {
        ...account,
        email: normalizeEmail(account.email),
      });
    }

    const accountsToSeed = [...accountsByEmail.values()];
    const passwordHash = await hashPassword(demoAccountPassword);
    const users = [];

    for (const account of accountsToSeed) {
      const user = await upsertUserAccount(account, passwordHash, client);
      users.push(user);

      await insertAuditLog(
        {
          requestId: randomUUID(),
          actorUserId: user.id,
          targetUserId: user.id,
          action: 'system.portal_account_seed',
          resourceType: 'user',
          resourceId: user.id,
          status: 'success',
          metadata: {
            email: user.email,
            role: user.role,
          },
        },
        client,
      );
    }

    return users;
  });

  logger.info(
    {
      count: seededUsers.length,
      emails: seededUsers.map((user) => user.email),
    },
    'Portal user accounts are ready.',
  );
}

async function seedAdminUser() {
  const parsed = bootstrapSchema.safeParse({
    ADMIN_BOOTSTRAP_NAME: env.ADMIN_BOOTSTRAP_NAME,
    ADMIN_BOOTSTRAP_EMAIL: env.ADMIN_BOOTSTRAP_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: env.ADMIN_BOOTSTRAP_PASSWORD,
  });

  if (!parsed.success) {
    logger.warn(
      'Skipping admin bootstrap because ADMIN_BOOTSTRAP_NAME, ADMIN_BOOTSTRAP_EMAIL, or ADMIN_BOOTSTRAP_PASSWORD is missing or invalid.',
    );
    return;
  }

  const email = normalizeEmail(parsed.data.ADMIN_BOOTSTRAP_EMAIL);
  const passwordHash = await hashPassword(parsed.data.ADMIN_BOOTSTRAP_PASSWORD);

  await withTransaction(async (client) => {
    const existingUser = await findUserByEmail(email, client);
    let adminUser;

    if (existingUser) {
      const result = await client.query(
        `
          UPDATE users
          SET name = $1,
              email = $2,
              password_hash = $3,
              role = 'admin',
              is_active = true,
              deleted_at = NULL,
              deleted_by = NULL,
              updated_at = NOW()
          WHERE id = $4
          RETURNING id, email
        `,
        [
          parsed.data.ADMIN_BOOTSTRAP_NAME,
          email,
          passwordHash,
          existingUser.id,
        ],
      );

      adminUser = result.rows[0];
    } else {
      const result = await client.query(
        `
          INSERT INTO users (name, email, password_hash, role, is_active)
          VALUES ($1, $2, $3, 'admin', true)
          RETURNING id, email
        `,
        [parsed.data.ADMIN_BOOTSTRAP_NAME, email, passwordHash],
      );

      adminUser = result.rows[0];
    }

    await insertAuditLog(
      {
        requestId: randomUUID(),
        actorUserId: adminUser.id,
        targetUserId: adminUser.id,
        action: 'system.admin_bootstrap',
        resourceType: 'user',
        resourceId: adminUser.id,
        status: 'success',
        metadata: {
          email: adminUser.email,
        },
      },
      client,
    );
  });

  logger.info({ email }, 'Admin bootstrap user is ready.');
}

// Sample school data for seeding
const sampleTeachers = [
  {
    user_id: null, // Will be set after user creation
    employee_id: 'T001',
    first_name: 'Abena',
    last_name: 'Mensah',
    email: 'abena.mensah@brightfuture.edu.gh',
    phone: '+233 24 123 4567',
    date_of_birth: '1985-03-15',
    gender: 'female',
    address: '123 Teacher Street, Accra',
    qualification: 'M.Ed Mathematics',
    specialization: 'Mathematics',
    hire_date: '2020-09-01',
    salary: 3500.00,
    is_active: true,
  },
  {
    user_id: null,
    employee_id: 'T002',
    first_name: 'Kofi',
    last_name: 'Asante',
    email: 'kofi.asante@brightfuture.edu.gh',
    phone: '+233 24 234 5678',
    date_of_birth: '1982-07-22',
    gender: 'male',
    address: '456 Education Avenue, Accra',
    qualification: 'B.Sc Computer Science',
    specialization: 'Computer Science',
    hire_date: '2019-09-01',
    salary: 3200.00,
    is_active: true,
  },
  {
    user_id: null,
    employee_id: 'T003',
    first_name: 'Akua',
    last_name: 'Sarpong',
    email: 'akua.sarpong@brightfuture.edu.gh',
    phone: '+233 24 345 6789',
    date_of_birth: '1988-11-08',
    gender: 'female',
    address: '789 Library Road, Accra',
    qualification: 'M.L.I.S Library Science',
    specialization: 'Library Science',
    hire_date: '2021-01-15',
    salary: 2800.00,
    is_active: true,
  },
];

const sampleClasses = [
  { name: 'Grade 1A', grade_level: 1, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 1B', grade_level: 1, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 2A', grade_level: 2, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 3A', grade_level: 3, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 4A', grade_level: 4, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 5A', grade_level: 5, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 6A', grade_level: 6, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 7A', grade_level: 7, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 8A', grade_level: 8, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 9A', grade_level: 9, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 10A', grade_level: 10, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 11A', grade_level: 11, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
  { name: 'Grade 12A', grade_level: 12, academic_year: '2024-2025', teacher_id: null, capacity: 25, is_active: true },
];

const sampleParents = [
  {
    user_id: null,
    first_name: 'Grace',
    last_name: 'Tetteh',
    email: 'grace.tetteh@brightfuture.edu.gh',
    phone: '+233 24 456 7890',
    address: '321 Parent Lane, Accra',
    occupation: 'Nurse',
    relationship: 'mother',
    is_primary: true,
  },
  {
    user_id: null,
    first_name: 'Emmanuel',
    last_name: 'Tetteh',
    email: 'emmanuel.tetteh@brightfuture.edu.gh',
    phone: '+233 24 567 8901',
    address: '321 Parent Lane, Accra',
    occupation: 'Engineer',
    relationship: 'father',
    is_primary: false,
  },
  {
    user_id: null,
    first_name: 'Mary',
    last_name: 'Osei',
    email: 'mary.osei@brightfuture.edu.gh',
    phone: '+233 24 678 9012',
    address: '654 Family Street, Accra',
    occupation: 'Teacher',
    relationship: 'mother',
    is_primary: true,
  },
  {
    user_id: null,
    first_name: 'David',
    last_name: 'Osei',
    email: 'david.osei@brightfuture.edu.gh',
    phone: '+233 24 789 0123',
    address: '654 Family Street, Accra',
    occupation: 'Businessman',
    relationship: 'father',
    is_primary: false,
  },
];

const sampleStudents = [
  {
    user_id: null,
    student_id: 'STU001',
    first_name: 'Kofi',
    last_name: 'Tetteh',
    date_of_birth: '2015-05-10',
    gender: 'male',
    address: '321 Parent Lane, Accra',
    enrollment_date: '2023-09-01',
    grade_level: 4,
    class_id: null, // Will be set after class creation
    is_active: true,
    medical_info: 'No known allergies',
    emergency_contact: 'Grace Tetteh (+233 24 456 7890)',
  },
  {
    user_id: null,
    student_id: 'STU002',
    first_name: 'Adwoa',
    last_name: 'Osei',
    date_of_birth: '2014-08-20',
    gender: 'female',
    address: '654 Family Street, Accra',
    enrollment_date: '2023-09-01',
    grade_level: 5,
    class_id: null,
    is_active: true,
    medical_info: 'Mild asthma',
    emergency_contact: 'Mary Osei (+233 24 678 9012)',
  },
  {
    user_id: null,
    student_id: 'STU003',
    first_name: 'Yaw',
    last_name: 'Mensah',
    date_of_birth: '2016-02-15',
    gender: 'male',
    address: '987 Student Road, Accra',
    enrollment_date: '2024-01-15',
    grade_level: 3,
    class_id: null,
    is_active: true,
    medical_info: 'None',
    emergency_contact: 'Abena Mensah (+233 24 123 4567)',
  },
];

const sampleStudentParents = [
  { student_id: null, parent_id: null }, // Kofi Tetteh - Grace Tetteh
  { student_id: null, parent_id: null }, // Kofi Tetteh - Emmanuel Tetteh
  { student_id: null, parent_id: null }, // Adwoa Osei - Mary Osei
  { student_id: null, parent_id: null }, // Adwoa Osei - David Osei
  { student_id: null, parent_id: null }, // Yaw Mensah - Abena Mensah (teacher as parent)
];

const sampleFeeCategories = [
  { name: 'Tuition Fee', description: 'Monthly tuition fee', amount: 500.00, frequency: 'monthly', grade_level: null, is_active: true },
  { name: 'Registration Fee', description: 'One-time registration fee', amount: 200.00, frequency: 'one-time', grade_level: null, is_active: true },
  { name: 'Library Fee', description: 'Annual library access fee', amount: 50.00, frequency: 'annual', grade_level: null, is_active: true },
  { name: 'Sports Fee', description: 'Annual sports activities fee', amount: 75.00, frequency: 'annual', grade_level: null, is_active: true },
  { name: 'Transportation Fee', description: 'Monthly transportation fee', amount: 100.00, frequency: 'monthly', grade_level: null, is_active: true },
];

const sampleTeacherSalaries = [
  { teacher_id: null, base_salary: 3500.00, allowances: 200.00, deductions: 150.00, effective_date: '2024-01-01', payment_frequency: 'monthly', currency: 'GHS', is_active: true },
  { teacher_id: null, base_salary: 3200.00, allowances: 180.00, deductions: 140.00, effective_date: '2024-01-01', payment_frequency: 'monthly', currency: 'GHS', is_active: true },
  { teacher_id: null, base_salary: 2800.00, allowances: 150.00, deductions: 120.00, effective_date: '2024-01-01', payment_frequency: 'monthly', currency: 'GHS', is_active: true },
];

async function seedSchoolData() {
  await withTransaction(async (client) => {
    // Seed teachers
    const teacherResults = [];
    for (const teacher of sampleTeachers) {
      const user = await findUserByEmail(teacher.email, client);
      if (user) {
        teacher.user_id = user.id;
      }

      const result = await client.query(`
        INSERT INTO teachers (user_id, employee_id, first_name, last_name, email, phone, date_of_birth, gender, address, qualification, specialization, hire_date, salary, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (email) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          employee_id = EXCLUDED.employee_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          date_of_birth = EXCLUDED.date_of_birth,
          gender = EXCLUDED.gender,
          address = EXCLUDED.address,
          qualification = EXCLUDED.qualification,
          specialization = EXCLUDED.specialization,
          hire_date = EXCLUDED.hire_date,
          salary = EXCLUDED.salary,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING id, first_name, last_name
      `, [
        teacher.user_id,
        teacher.employee_id,
        teacher.first_name,
        teacher.last_name,
        teacher.email,
        teacher.phone,
        teacher.date_of_birth,
        teacher.gender,
        teacher.address,
        teacher.qualification,
        teacher.specialization,
        teacher.hire_date,
        teacher.salary,
        teacher.is_active
      ]);
      teacherResults.push(result.rows[0]);
    }

    // Seed classes and assign teachers
    const classResults = [];
    for (let i = 0; i < sampleClasses.length; i++) {
      const classData = sampleClasses[i];
      const teacherId = i < teacherResults.length ? teacherResults[i].id : teacherResults[0].id; // Assign teachers to classes

      const result = await client.query(`
        INSERT INTO classes (name, grade_level, academic_year, teacher_id, capacity, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name, academic_year) DO UPDATE SET
          grade_level = EXCLUDED.grade_level,
          teacher_id = EXCLUDED.teacher_id,
          capacity = EXCLUDED.capacity,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING id, name
      `, [
        classData.name,
        classData.grade_level,
        classData.academic_year,
        teacherId,
        classData.capacity,
        classData.is_active
      ]);
      classResults.push(result.rows[0]);
    }

    // Seed parents
    const parentResults = [];
    for (const parent of sampleParents) {
      const user = await findUserByEmail(parent.email, client);
      if (user) {
        parent.user_id = user.id;
      }

      const result = await client.query(`
        INSERT INTO parents (user_id, first_name, last_name, email, phone, address, occupation, relationship, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (email) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          occupation = EXCLUDED.occupation,
          relationship = EXCLUDED.relationship,
          is_primary = EXCLUDED.is_primary,
          updated_at = NOW()
        RETURNING id, first_name, last_name
      `, [
        parent.user_id,
        parent.first_name,
        parent.last_name,
        parent.email,
        parent.phone,
        parent.address,
        parent.occupation,
        parent.relationship,
        parent.is_primary
      ]);
      parentResults.push(result.rows[0]);
    }

    // Seed students and assign to classes
    const studentResults = [];
    for (let i = 0; i < sampleStudents.length; i++) {
      const student = sampleStudents[i];
      const classId = classResults.find(c => c.name.includes(`Grade ${student.grade_level}`))?.id || classResults[0].id;

      const result = await client.query(`
        INSERT INTO students (user_id, student_id, first_name, last_name, date_of_birth, gender, address, enrollment_date, grade_level, class_id, is_active, medical_info, emergency_contact)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (student_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          date_of_birth = EXCLUDED.date_of_birth,
          gender = EXCLUDED.gender,
          address = EXCLUDED.address,
          enrollment_date = EXCLUDED.enrollment_date,
          grade_level = EXCLUDED.grade_level,
          class_id = EXCLUDED.class_id,
          is_active = EXCLUDED.is_active,
          medical_info = EXCLUDED.medical_info,
          emergency_contact = EXCLUDED.emergency_contact,
          updated_at = NOW()
        RETURNING id, first_name, last_name
      `, [
        student.user_id,
        student.student_id,
        student.first_name,
        student.last_name,
        student.date_of_birth,
        student.gender,
        student.address,
        student.enrollment_date,
        student.grade_level,
        classId,
        student.is_active,
        student.medical_info,
        student.emergency_contact
      ]);
      studentResults.push(result.rows[0]);
    }

    // Seed student-parent relationships
    for (const relation of sampleStudentParents) {
      const student = studentResults.find(s => s.first_name === 'Kofi' && relation === sampleStudentParents[0] ? true :
                                               s.first_name === 'Kofi' && relation === sampleStudentParents[1] ? true :
                                               s.first_name === 'Adwoa' && relation === sampleStudentParents[2] ? true :
                                               s.first_name === 'Adwoa' && relation === sampleStudentParents[3] ? true :
                                               s.first_name === 'Yaw' && relation === sampleStudentParents[4] ? true : false);
      const parent = parentResults.find(p => p.first_name === 'Grace' && relation === sampleStudentParents[0] ? true :
                                             p.first_name === 'Emmanuel' && relation === sampleStudentParents[1] ? true :
                                             p.first_name === 'Mary' && relation === sampleStudentParents[2] ? true :
                                             p.first_name === 'David' && relation === sampleStudentParents[3] ? true :
                                             p.first_name === 'Abena' && relation === sampleStudentParents[4] ? true : false);

      if (student && parent) {
        await client.query(`
          INSERT INTO student_parents (student_id, parent_id)
          VALUES ($1, $2)
          ON CONFLICT (student_id, parent_id) DO NOTHING
        `, [student.id, parent.id]);
      }
    }

    // Seed fee categories
    const feeCategoryResults = [];
    for (const fee of sampleFeeCategories) {
      const result = await client.query(`
        INSERT INTO finance_fee_categories (name, description, amount, frequency, grade_level, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          amount = EXCLUDED.amount,
          frequency = EXCLUDED.frequency,
          grade_level = EXCLUDED.grade_level,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING id, name
      `, [
        fee.name,
        fee.description,
        fee.amount,
        fee.frequency,
        fee.grade_level,
        fee.is_active
      ]);
      feeCategoryResults.push(result.rows[0]);
    }

    // Seed teacher salaries
    for (let i = 0; i < sampleTeacherSalaries.length && i < teacherResults.length; i++) {
      const salary = sampleTeacherSalaries[i];
      const teacherId = teacherResults[i].id;

      await client.query(`
        INSERT INTO teacher_salaries (teacher_id, base_salary, allowances, deductions, effective_date, payment_frequency, currency, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (teacher_id, effective_date) DO UPDATE SET
          base_salary = EXCLUDED.base_salary,
          allowances = EXCLUDED.allowances,
          deductions = EXCLUDED.deductions,
          payment_frequency = EXCLUDED.payment_frequency,
          currency = EXCLUDED.currency,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `, [
        teacherId,
        salary.base_salary,
        salary.allowances,
        salary.deductions,
        salary.effective_date,
        salary.payment_frequency,
        salary.currency,
        salary.is_active
      ]);
    }

    logger.info({
      teachers: teacherResults.length,
      classes: classResults.length,
      parents: parentResults.length,
      students: studentResults.length,
      feeCategories: feeCategoryResults.length
    }, 'School data seeded successfully.');
  });
}

seedAdminUser()
  .then(seedPortalAccounts)
  .then(seedSchoolData)
  .catch((error) => {
    logger.error({ error }, 'Database seed failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
