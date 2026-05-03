import express from 'express';
import { checkDatabaseHealth } from '../db/index.js';
import { checkRedisHealth } from '../db/redis.js';
import { asyncHandler } from '../lib/async-handler.js';

const router = express.Router();

router.get(
  '/live',
  asyncHandler(async (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }),
);

router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const [database, redis] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const healthy = database.status === 'ok' && redis.status === 'ok';

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      checks: {
        database,
        redis,
      },
      timestamp: new Date().toISOString(),
    });
  }),
);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.redirect(302, '/health/ready');
  }),
);

export default router;
