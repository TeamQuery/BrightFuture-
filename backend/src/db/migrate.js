import { closePostgresPool } from './index.js';
import pool from './index.js';
import { logger } from '../lib/logger.js';

async function migrate() {
  const client = await pool.connect();

  try {
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

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'users_set_updated_at'
        ) THEN
          CREATE TRIGGER users_set_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION set_row_updated_at();
        END IF;
      END
      $$;
    `);

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

    // Index strategy:
    // 1. Partial unique index keeps active emails unique while supporting soft delete.
    // 2. Role and login indexes support frequent auth/admin lookups.
    // 3. Audit indexes favor recent chronological investigations by actor, target, and action.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_active_idx
      ON users (LOWER(email))
      WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS users_role_active_idx
      ON users (role)
      WHERE deleted_at IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS users_last_login_idx
      ON users (last_login_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
      ON audit_logs (actor_user_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS audit_logs_target_created_idx
      ON audit_logs (target_user_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
      ON audit_logs (action, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx
      ON audit_logs (request_id);
    `);

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
