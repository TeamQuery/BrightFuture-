import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

function shouldUseSsl(connectionString) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get('sslmode');

  return (
    env.NODE_ENV === 'production' ||
    sslMode === 'require' ||
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.pooler.supabase.com')
  );
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  min: env.DATABASE_POOL_MIN,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  ssl: shouldUseSsl(env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.debug('PostgreSQL pool acquired a new client.');
});

pool.on('error', (error) => {
  logger.error({ error }, 'Unexpected PostgreSQL pool error.');
});

export async function query(text, params = [], client = pool) {
  return client.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth() {
  const startedAt = Date.now();
  await pool.query('SELECT 1');

  return {
    status: 'ok',
    latencyMs: Date.now() - startedAt,
  };
}

export async function closePostgresPool() {
  await pool.end();
}

export default pool;
