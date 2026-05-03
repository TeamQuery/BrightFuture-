import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseHealth, closePostgresPool } from './db/index.js';
import { closeRedisClient, getRedisClient } from './db/redis.js';
import { logger } from './lib/logger.js';

let server;

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down API process.');

  if (!server) {
    await Promise.allSettled([closePostgresPool(), closeRedisClient()]);
    process.exit(0);
  }

  server.close(async (error) => {
    if (error) {
      logger.error({ error }, 'Failed to close HTTP server cleanly.');
      process.exit(1);
    }

    await Promise.allSettled([closePostgresPool(), closeRedisClient()]);
    process.exit(0);
  });
}

async function bootstrap() {
  await Promise.all([checkDatabaseHealth(), getRedisClient()]);

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'BrightFuture API listening.');
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (error) => {
  logger.error({ error }, 'Unhandled promise rejection.');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception.');
  process.exit(1);
});

bootstrap().catch(async (error) => {
  logger.fatal({ error }, 'Failed to start BrightFuture API.');
  await Promise.allSettled([closePostgresPool(), closeRedisClient()]);
  process.exit(1);
});
