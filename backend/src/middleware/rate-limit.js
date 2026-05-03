import { asyncHandler } from '../lib/async-handler.js';
import { RateLimitError, ServiceUnavailableError } from '../lib/errors.js';
import { getRedisClient } from '../db/redis.js';
import { env } from '../config/env.js';

async function consumeRateLimit({ name, key, limit, windowSeconds }) {
  const redis = await getRedisClient();
  const windowBucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const redisKey = `${env.REDIS_KEY_PREFIX}:ratelimit:${name}:${key}:${windowBucket}`;

  try {
    const totalHits = await redis.incr(redisKey);

    if (totalHits === 1) {
      await redis.expire(redisKey, windowSeconds + 1);
    }

    const retryAfter = await redis.ttl(redisKey);

    return {
      totalHits,
      retryAfter: Math.max(retryAfter, 0),
      remaining: Math.max(limit - totalHits, 0),
      limit,
    };
  } catch (error) {
    throw new ServiceUnavailableError('Rate limiter backend is unavailable.');
  }
}

export function createRateLimiter({ name, limit, windowSeconds, keyGenerator }) {
  return asyncHandler(async (req, res, next) => {
    const key = await keyGenerator(req);

    if (!key) {
      return next();
    }

    const result = await consumeRateLimit({
      name,
      key,
      limit,
      windowSeconds,
    });

    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(result.retryAfter));

    if (result.totalHits > limit) {
      throw new RateLimitError(
        `Rate limit exceeded for ${name}. Please slow down and try again shortly.`,
        result.retryAfter,
      );
    }

    next();
  });
}

export const ipRateLimiter = createRateLimiter({
  name: 'ip',
  limit: 1000,
  windowSeconds: 60,
  keyGenerator: async (req) => req.ip,
});

export const userRateLimiter = createRateLimiter({
  name: 'user',
  limit: 100,
  windowSeconds: 60,
  keyGenerator: async (req) => req.user?.id ?? null,
});

export const credentialRateLimiter = createRateLimiter({
  name: 'auth-credentials',
  limit: 10,
  windowSeconds: 60,
  keyGenerator: async (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : 'anonymous';
    return `${req.ip}:${email}`;
  },
});
