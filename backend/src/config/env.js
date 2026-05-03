import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const sourceEnv = {
  ...process.env,
  CORS_ORIGIN_WHITELIST:
    process.env.CORS_ORIGIN_WHITELIST ??
    process.env.FRONTEND_URL ??
    'http://localhost:3000,http://localhost:3001',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_KEY:
    process.env.SUPABASE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
  COOKIE_SECURE:
    process.env.COOKIE_SECURE ??
    (process.env.NODE_ENV === 'production' ? 'true' : 'false'),
  TRUST_PROXY: process.env.TRUST_PROXY ?? 'true',
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(20),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).max(20).default(2),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(5000),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  REDIS_KEY_PREFIX: z.string().min(1).default('brightfuture'),
  CORS_ORIGIN_WHITELIST: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT access secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  COOKIE_NAME_REFRESH: z.string().default('refreshToken'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  TRUST_PROXY: z.enum(['true', 'false']).default('true'),
  BCRYPT_COST: z.coerce.number().int().min(10).max(14).default(12),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_KEY: z.string().min(1, 'SUPABASE_KEY is required'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  ADMIN_BOOTSTRAP_NAME: z.string().optional(),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(sourceEnv);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');

  throw new Error(`Invalid environment configuration: ${issues}`);
}

if (
  parsed.data.NODE_ENV === 'production' &&
  parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET
) {
  throw new Error(
    'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production.',
  );
}

export const env = {
  ...parsed.data,
  COOKIE_SECURE: parsed.data.COOKIE_SECURE === 'true',
  TRUST_PROXY: parsed.data.TRUST_PROXY === 'true',
  CORS_ORIGINS: parsed.data.CORS_ORIGIN_WHITELIST.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
