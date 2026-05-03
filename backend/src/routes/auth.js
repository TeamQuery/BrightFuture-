import express from 'express';
import { env } from '../config/env.js';
import { withTransaction } from '../db/index.js';
import { asyncHandler } from '../lib/async-handler.js';
import {
  ConflictError,
  UnauthorizedError,
} from '../lib/errors.js';
import {
  extractBearerToken,
  getRefreshCookieClearOptions,
  getRefreshCookieOptions,
  hashPassword,
  normalizeEmail,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from '../lib/security.js';
import { authenticate } from '../middleware/auth.js';
import { credentialRateLimiter, userRateLimiter } from '../middleware/rate-limit.js';
import { validate } from '../middleware/validate.js';
import { insertAuditLog } from '../repositories/audit-repository.js';
import {
  createUser,
  findActiveUserById,
  findUserByEmail,
  findUserForAuthByEmail,
  updateLastLogin,
} from '../repositories/user-repository.js';
import {
  getSession,
  issueAuthTokens,
  revokeAccessToken,
  revokeAllUserSessions,
  revokeSession,
} from '../services/auth-service.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

const router = express.Router();

function sendAuthResponse(res, user, tokens, statusCode = 200) {
  res.cookie(env.COOKIE_NAME_REFRESH, tokens.refreshToken, getRefreshCookieOptions());

  res.status(statusCode).json({
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    user,
  });
}

router.post(
  '/register',
  credentialRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const existingUser = await findUserByEmail(req.body.email);

    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictError('An account with this email already exists.');
    }

    const passwordHash = await hashPassword(req.body.password);

    const user = await withTransaction(async (client) => {
      const createdUser = await createUser(
        {
          name: req.body.name,
          email: req.body.email,
          passwordHash,
          role: 'parent',
        },
        client,
      );

      await insertAuditLog(
        {
          requestId: req.id,
          actorUserId: createdUser.id,
          targetUserId: createdUser.id,
          action: 'auth.register',
          resourceType: 'user',
          resourceId: createdUser.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            email: createdUser.email,
            role: createdUser.role,
          },
        },
        client,
      );

      return createdUser;
    });

    const tokens = await issueAuthTokens({
      user,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    sendAuthResponse(res, user, tokens, 201);
  }),
);

router.post(
  '/login',
  credentialRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const user = await findUserForAuthByEmail(email);
    const passwordMatches = user
      ? await verifyPassword(req.body.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches || user.deletedAt || !user.isActive) {
      await insertAuditLog({
        requestId: req.id,
        actorUserId: null,
        targetUserId: user?.id ?? null,
        action: 'auth.login',
        resourceType: 'user',
        resourceId: user?.id ?? null,
        status: 'failure',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          email,
          reason: 'invalid_credentials',
        },
      });

      throw new UnauthorizedError('Invalid email or password.');
    }

    const updatedUser = await updateLastLogin(user.id);
    const tokens = await issueAuthTokens({
      user: updatedUser,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    await insertAuditLog({
      requestId: req.id,
      actorUserId: updatedUser.id,
      targetUserId: updatedUser.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: updatedUser.id,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        email: updatedUser.email,
      },
    });

    sendAuthResponse(res, updatedUser, tokens);
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[env.COOKIE_NAME_REFRESH];

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is missing.');
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      res.clearCookie(env.COOKIE_NAME_REFRESH, getRefreshCookieClearOptions());
      throw new UnauthorizedError('Refresh token is invalid or expired.');
    }

    const session = await getSession(payload.sid);

    if (!session) {
      res.clearCookie(env.COOKIE_NAME_REFRESH, getRefreshCookieClearOptions());
      throw new UnauthorizedError('Refresh token is invalid or expired.');
    }

    if (session.currentRefreshTokenId !== payload.jti) {
      await revokeAllUserSessions(payload.sub);
      await insertAuditLog({
        requestId: req.id,
        actorUserId: payload.sub,
        targetUserId: payload.sub,
        action: 'auth.refresh_reuse_detected',
        resourceType: 'user',
        resourceId: payload.sub,
        status: 'failure',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          sessionId: payload.sid,
        },
      });

      res.clearCookie(env.COOKIE_NAME_REFRESH, getRefreshCookieClearOptions());
      throw new UnauthorizedError(
        'Refresh token reuse detected. All active sessions have been revoked.',
      );
    }

    const user = await findActiveUserById(payload.sub);

    if (!user || !user.isActive) {
      await revokeAllUserSessions(payload.sub);
      res.clearCookie(env.COOKIE_NAME_REFRESH, getRefreshCookieClearOptions());
      throw new UnauthorizedError('Refresh token is invalid or expired.');
    }

    const tokens = await issueAuthTokens({
      user,
      sessionId: payload.sid,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    await insertAuditLog({
      requestId: req.id,
      actorUserId: user.id,
      targetUserId: user.id,
      action: 'auth.refresh',
      resourceType: 'session',
      resourceId: payload.sid,
      status: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: {
        sessionId: payload.sid,
      },
    });

    sendAuthResponse(res, user, tokens);
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.[env.COOKIE_NAME_REFRESH];
    let actorUserId = null;
    let sessionId = null;
    let accessTokenId = null;
    let accessTokenExpiresAt = null;

    if (refreshToken) {
      try {
        const refreshPayload = verifyRefreshToken(refreshToken);
        actorUserId = refreshPayload.sub;
        sessionId = refreshPayload.sid;
      } catch (error) {
        sessionId = null;
      }
    }

    const accessToken = extractBearerToken(req.headers.authorization);
    if (accessToken) {
      try {
        const accessPayload = verifyAccessToken(accessToken);
        actorUserId ??= accessPayload.sub;
        sessionId ??= accessPayload.sid;
        accessTokenId = accessPayload.jti;
        accessTokenExpiresAt = accessPayload.exp;
      } catch (error) {
        // Ignore malformed or expired access tokens during logout.
      }
    }

    if (sessionId) {
      await revokeSession(sessionId, actorUserId);
    }

    if (accessTokenId && accessTokenExpiresAt) {
      await revokeAccessToken(accessTokenId, accessTokenExpiresAt);
    }

    if (actorUserId) {
      await insertAuditLog({
        requestId: req.id,
        actorUserId,
        targetUserId: actorUserId,
        action: 'auth.logout',
        resourceType: 'session',
        resourceId: sessionId,
        status: 'success',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          sessionId,
        },
      });
    }

    res.clearCookie(env.COOKIE_NAME_REFRESH, getRefreshCookieClearOptions());
    res.status(204).send();
  }),
);

router.get(
  '/me',
  authenticate,
  userRateLimiter,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);

export default router;
