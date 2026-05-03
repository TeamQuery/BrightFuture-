import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { getRedisClient } from '../db/redis.js';
import { buildAccessToken, buildRefreshToken } from '../lib/security.js';

function sessionKey(sessionId) {
  return `${env.REDIS_KEY_PREFIX}:session:${sessionId}`;
}

function userSessionsKey(userId) {
  return `${env.REDIS_KEY_PREFIX}:user-sessions:${userId}`;
}

function accessDenyKey(tokenId) {
  return `${env.REDIS_KEY_PREFIX}:denylist:access:${tokenId}`;
}

function ttlFromIso(isoTimestamp) {
  return Math.max(
    1,
    Math.ceil((new Date(isoTimestamp).getTime() - Date.now()) / 1000),
  );
}

async function persistSession({
  sessionId,
  userId,
  role,
  refreshTokenId,
  refreshTokenExpiresAt,
  ipAddress,
  userAgent,
}) {
  const redis = await getRedisClient();
  const ttlSeconds = ttlFromIso(refreshTokenExpiresAt);
  const now = new Date().toISOString();

  const multi = redis.multi();
  multi.hSet(sessionKey(sessionId), {
    userId,
    role,
    currentRefreshTokenId: refreshTokenId,
    ipAddress: ipAddress ?? '',
    userAgent: userAgent ?? '',
    createdAt: now,
    lastRotatedAt: now,
  });
  multi.expire(sessionKey(sessionId), ttlSeconds);
  multi.sAdd(userSessionsKey(userId), sessionId);
  multi.expire(userSessionsKey(userId), ttlSeconds);

  await multi.exec();
}

export async function issueAuthTokens({ user, sessionId = randomUUID(), ipAddress, userAgent }) {
  const access = buildAccessToken({
    userId: user.id,
    role: user.role,
    sessionId,
  });

  const refresh = buildRefreshToken({
    userId: user.id,
    role: user.role,
    sessionId,
  });

  await persistSession({
    sessionId,
    userId: user.id,
    role: user.role,
    refreshTokenId: refresh.tokenId,
    refreshTokenExpiresAt: refresh.expiresAt,
    ipAddress,
    userAgent,
  });

  return {
    sessionId,
    accessToken: access.token,
    accessTokenId: access.tokenId,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken: refresh.token,
    refreshTokenId: refresh.tokenId,
    refreshTokenExpiresAt: refresh.expiresAt,
  };
}

export async function getSession(sessionId) {
  const redis = await getRedisClient();
  const session = await redis.hGetAll(sessionKey(sessionId));

  if (!session?.userId) {
    return null;
  }

  return session;
}

export async function revokeSession(sessionId, userIdHint) {
  const redis = await getRedisClient();
  const session = await getSession(sessionId);
  const userId = session?.userId ?? userIdHint;

  const multi = redis.multi();
  multi.del(sessionKey(sessionId));

  if (userId) {
    multi.sRem(userSessionsKey(userId), sessionId);
  }

  await multi.exec();
  return session;
}

export async function revokeAllUserSessions(userId) {
  const redis = await getRedisClient();
  const sessions = await redis.sMembers(userSessionsKey(userId));

  const multi = redis.multi();
  for (const sessionId of sessions) {
    multi.del(sessionKey(sessionId));
  }
  multi.del(userSessionsKey(userId));
  await multi.exec();

  return sessions.length;
}

export async function revokeAccessToken(tokenId, tokenExpiresAtEpochSeconds) {
  const redis = await getRedisClient();
  const ttlSeconds = Math.max(1, tokenExpiresAtEpochSeconds - Math.floor(Date.now() / 1000));

  await redis.set(accessDenyKey(tokenId), '1', {
    EX: ttlSeconds,
  });
}

export async function isAccessTokenRevoked(tokenId) {
  const redis = await getRedisClient();
  const exists = await redis.exists(accessDenyKey(tokenId));
  return exists === 1;
}
