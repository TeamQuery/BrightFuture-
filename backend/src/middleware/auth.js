import { findActiveUserById } from '../repositories/user-repository.js';
import { asyncHandler } from '../lib/async-handler.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { extractBearerToken, verifyAccessToken } from '../lib/security.js';
import { getSession, isAccessTokenRevoked } from '../services/auth-service.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    throw new UnauthorizedError('A valid bearer access token is required.');
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw new UnauthorizedError('Access token is invalid or expired.');
  }

  if (payload.type !== 'access') {
    throw new UnauthorizedError('Invalid access token type.');
  }

  if (await isAccessTokenRevoked(payload.jti)) {
    throw new UnauthorizedError('Access token has been revoked.');
  }

  const session = await getSession(payload.sid);

  if (!session || session.userId !== payload.sub) {
    throw new UnauthorizedError('The session associated with this access token is no longer active.');
  }

  const user = await findActiveUserById(payload.sub);

  if (!user || !user.isActive || user.deletedAt) {
    throw new UnauthorizedError('The account associated with this token is unavailable.');
  }

  req.user = user;
  req.auth = {
    sessionId: payload.sid,
    tokenId: payload.jti,
    expiresAtEpochSeconds: payload.exp,
    subject: payload.sub,
    role: payload.role,
  };

  next();
});

export function authorize(...roles) {
  return function authorizationMiddleware(req, _res, next) {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication is required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }

    return next();
  };
}
