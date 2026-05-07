import { z } from 'zod';
import { env } from '../config/env.js';

function isConfiguredDemoPassword(value) {
  const demoPassword = env.ACCOUNTS_PASSWORD ?? env.DEMO_ACCOUNT_PASSWORD;
  return env.NODE_ENV !== 'production' && demoPassword === value;
}

function addPasswordIssue(context, message) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message,
  });
}

export const strongPasswordSchema = z.string().superRefine((value, context) => {
  if (isConfiguredDemoPassword(value)) {
    return;
  }

  if (value.length < 12) {
    addPasswordIssue(context, 'Password must be at least 12 characters long.');
  }

  if (value.length > 128) {
    addPasswordIssue(context, 'Password must be 128 characters or fewer.');
  }

  if (!/[a-z]/.test(value)) {
    addPasswordIssue(context, 'Password must include at least one lowercase letter.');
  }

  if (!/[A-Z]/.test(value)) {
    addPasswordIssue(context, 'Password must include at least one uppercase letter.');
  }

  if (!/[0-9]/.test(value)) {
    addPasswordIssue(context, 'Password must include at least one number.');
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    addPasswordIssue(context, 'Password must include at least one special character.');
  }

  if (value.trim() !== value) {
    addPasswordIssue(context, 'Password must not start or end with whitespace.');
  }
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: strongPasswordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

export const userIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
