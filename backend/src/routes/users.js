import express from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { userRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { listAuditLogs, insertAuditLog } from '../repositories/audit-repository.js';
import {
  listUsers,
  softDeleteUser,
} from '../repositories/user-repository.js';
import { revokeAllUserSessions } from '../services/auth-service.js';
import { paginationQuerySchema, userIdParamsSchema } from './auth.schemas.js';

const router = express.Router();

router.use(authenticate, userRateLimiter, authorize('admin'));

router.get(
  '/',
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req, res) => {
    const users = await listUsers(req.query.limit);
    res.json({ users });
  }),
);

router.get(
  '/audit-logs',
  validate({ query: paginationQuerySchema }),
  asyncHandler(async (req, res) => {
    const auditLogs = await listAuditLogs(req.query.limit);
    res.json({ auditLogs });
  }),
);

router.delete(
  '/:id',
  validate({ params: userIdParamsSchema }),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
      throw new BadRequestError('Use a separate self-service deactivation flow for your own account.');
    }

    const deletedUser = await softDeleteUser({
      userId: req.params.id,
      deletedBy: req.user.id,
    });

    if (!deletedUser) {
      throw new NotFoundError('User not found or already deleted.');
    }

    await revokeAllUserSessions(deletedUser.id);
    await insertAuditLog({
      requestId: req.id,
      actorUserId: req.user.id,
      targetUserId: deletedUser.id,
      action: 'user.soft_delete',
      resourceType: 'user',
      resourceId: deletedUser.id,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        deletedEmail: deletedUser.email,
      },
    });

    res.json({
      message: 'User soft-deleted successfully.',
      user: deletedUser,
    });
  }),
);

export default router;
