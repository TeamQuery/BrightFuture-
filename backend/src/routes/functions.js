import express from 'express';
import { z } from 'zod';
import { executeJsonFunction } from '../lib/db-functions.js';
import { asyncHandler } from '../lib/async-handler.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { userRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { getRegisteredFunction, listRegisteredFunctions } from './function-registry.js';

const jsonScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const jsonValueSchema = z.lazy(() =>
  z.union([jsonScalarSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);
const typedArrayArgumentSchema = z.object({
  type: z.literal('array'),
  sqlType: z.string().regex(/^[a-z][a-z0-9_\[\]]*$/).optional(),
  value: z.array(jsonValueSchema),
});
const typedJsonArgumentSchema = z.object({
  type: z.literal('jsonb'),
  value: jsonValueSchema,
});
const functionArgumentSchema = z.union([
  typedArrayArgumentSchema,
  typedJsonArgumentSchema,
  jsonValueSchema,
]);

const functionParamsSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/),
  schema: z.string().regex(/^[a-z][a-z0-9_]*$/),
});

const functionInvocationSchema = z
  .object({
    args: z.array(functionArgumentSchema).max(20).optional(),
  })
  .default({})
  .transform(({ args = [] }) => ({ args }));

const router = express.Router();

router.use(authenticate, userRateLimiter);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') {
      throw new ForbiddenError();
    }

    res.json({
      invocation: {
        body: {
          args: [
            'plain scalars stay scalars',
            { type: 'jsonb', value: { example: true } },
            { type: 'array', sqlType: 'integer[]', value: [1, 2, 3] },
          ],
        },
      },
      functions: listRegisteredFunctions(),
    });
  }),
);

router.post(
  '/:schema/:name',
  validate({
    body: functionInvocationSchema,
    params: functionParamsSchema,
  }),
  asyncHandler(async (req, res) => {
    const metadata = getRegisteredFunction(req.params.schema, req.params.name);

    if (!metadata) {
      throw new NotFoundError('The requested database function is not exposed by this API.');
    }

    if (!metadata.roles.includes(req.user.role)) {
      throw new ForbiddenError();
    }

    const qualifiedName = `${req.params.schema}.${req.params.name}`;
    const result = await executeJsonFunction(qualifiedName, req.body.args);

    res.json(result);
  }),
);

export default router;
