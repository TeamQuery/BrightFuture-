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
  const passwordHash = await hashPassword(demoAccountPassword);

  const seededUsers = await withTransaction(async (client) => {
    const sourceAccounts = await loadPortalSourceAccounts(client);
    const accountsByEmail = new Map();

    for (const account of [...sourceAccounts, ...demoAccounts]) {
      accountsByEmail.set(normalizeEmail(account.email), {
        ...account,
        email: normalizeEmail(account.email),
      });
    }

    const users = [];

    for (const account of accountsByEmail.values()) {
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

seedAdminUser()
  .then(seedPortalAccounts)
  .catch((error) => {
    logger.error({ error }, 'Database seed failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
