import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { durationToMilliseconds } from './duration.js';

const TOKEN_ISSUER = 'brightfuture-api';
const TOKEN_AUDIENCE = 'brightfuture-clients';

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, env.BCRYPT_COST);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function buildAccessToken({ userId, role, sessionId }) {
  const tokenId = randomUUID();
  const token = jwt.sign(
    {
      sub: userId,
      role,
      type: 'access',
      sid: sessionId,
      jti: tokenId,
    },
    env.JWT_ACCESS_SECRET,
    {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      expiresIn: env.JWT_ACCESS_TTL,
    },
  );

  const payload = jwt.decode(token);

  return {
    token,
    tokenId,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function buildRefreshToken({ userId, role, sessionId }) {
  const tokenId = randomUUID();
  const token = jwt.sign(
    {
      sub: userId,
      role,
      type: 'refresh',
      sid: sessionId,
      jti: tokenId,
    },
    env.JWT_REFRESH_SECRET,
    {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      expiresIn: env.JWT_REFRESH_TTL,
    },
  );

  const payload = jwt.decode(token);

  return {
    token,
    tokenId,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.COOKIE_SECURE,
    path: '/api',
    maxAge: durationToMilliseconds(env.JWT_REFRESH_TTL),
  };
}

export function getRefreshCookieClearOptions() {
  const { maxAge, ...options } = getRefreshCookieOptions();
  void maxAge;
  return options;
}

export function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.slice('Bearer '.length).trim();
}
