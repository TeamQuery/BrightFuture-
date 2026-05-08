import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseHealth, closePostgresPool } from './db/index.js';
import { closeRedisClient, getRedisClient } from './db/redis.js';
import { logger } from './lib/logger.js';

let server;

function defaultFallbackPorts(startPort) {
  if (env.NODE_ENV === 'production') {
    return [];
  }

  return Array.from({ length: 5 }, (_, index) => startPort + index + 1)
    .filter((port) => port <= 65535);
}

function listen(port) {
  return new Promise((resolve, reject) => {
    const nextServer = app.listen(port);

    nextServer.once('listening', () => {
      resolve(nextServer);
    });

    nextServer.once('error', (error) => {
      reject(error);
    });
  });
}

async function listenOnAvailablePort() {
  const fallbackPorts = env.PORT_FALLBACKS.length
    ? env.PORT_FALLBACKS
    : defaultFallbackPorts(env.PORT);
  const portsToTry = [...new Set([env.PORT, ...fallbackPorts])];

  for (const port of portsToTry) {
    try {
      const nextServer = await listen(port);

      if (port !== env.PORT) {
        logger.warn(
          { requestedPort: env.PORT, selectedPort: port },
          'Requested port was unavailable; BrightFuture API switched to a fallback port.',
        );
      }

      return { server: nextServer, port };
    } catch (error) {
      if (error.code !== 'EADDRINUSE') {
        throw error;
      }

      logger.warn({ port }, 'Port is already in use; trying another port.');
    }
  }

  const error = new Error(`No available API port found. Tried: ${portsToTry.join(', ')}`);
  error.code = 'EADDRINUSE';
  throw error;
}

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

  const listening = await listenOnAvailablePort();
  server = listening.server;
  logger.info({ port: listening.port }, 'BrightFuture API listening.');

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
