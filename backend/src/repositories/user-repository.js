import pool from '../db/index.js';
import { normalizeEmail } from '../lib/security.js';

function mapUserRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export async function findUserByEmail(email, client = pool) {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        email,
        role,
        is_active AS "isActive",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return mapUserRow(result.rows[0]);
}

export async function findUserForAuthByEmail(email, client = pool) {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        email,
        role,
        password_hash AS "passwordHash",
        is_active AS "isActive",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return result.rows[0] ?? null;
}

export async function findActiveUserById(id, client = pool) {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        email,
        role,
        is_active AS "isActive",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [id],
  );

  return mapUserRow(result.rows[0]);
}

export async function createUser(
  { name, email, passwordHash, role = 'parent', isActive = true },
  client = pool,
) {
  const result = await client.query(
    `
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        name,
        email,
        role,
        is_active AS "isActive",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
    `,
    [name, normalizeEmail(email), passwordHash, role, isActive],
  );

  return mapUserRow(result.rows[0]);
}

export async function updateLastLogin(userId, client = pool) {
  const result = await client.query(
    `
      UPDATE users
      SET last_login_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        role,
        is_active AS "isActive",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
    `,
    [userId],
  );

  return mapUserRow(result.rows[0]);
}

export async function softDeleteUser({ userId, deletedBy }, client = pool) {
  const result = await client.query(
    `
      UPDATE users
      SET deleted_at = NOW(),
          deleted_by = $2,
          is_active = false,
          updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING
        id,
        name,
        email,
        role,
        is_active AS "isActive",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
    `,
    [userId, deletedBy],
  );

  return mapUserRow(result.rows[0]);
}

export async function listUsers(limit = 50, client = pool) {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        email,
        role,
        is_active AS "isActive",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt",
        deleted_at AS "deletedAt"
      FROM users
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapUserRow);
}
