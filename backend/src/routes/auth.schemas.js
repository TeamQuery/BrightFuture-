import { z } from 'zod';

export const strongPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long.')
  .max(128, 'Password must be 128 characters or fewer.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/[0-9]/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character.')
  .refine(
    (value) => value.trim() === value,
    'Password must not start or end with whitespace.',
  );

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
