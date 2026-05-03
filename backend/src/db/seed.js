import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { closePostgresPool, withTransaction } from './index.js';
import { logger } from '../lib/logger.js';
import { strongPasswordSchema } from '../routes/auth.schemas.js';
import { insertAuditLog } from '../repositories/audit-repository.js';
import { findUserByEmail } from '../repositories/user-repository.js';
import { hashPassword, normalizeEmail } from '../lib/security.js';

const bootstrapSchema = z.object({
  ADMIN_BOOTSTRAP_NAME: z.string().trim().min(2),
  ADMIN_BOOTSTRAP_EMAIL: z.string().trim().email(),
  ADMIN_BOOTSTRAP_PASSWORD: strongPasswordSchema,
});

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
  .catch((error) => {
    logger.error({ error }, 'Admin bootstrap failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresPool();
  });
