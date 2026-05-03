import { randomUUID } from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'brightfuture-backend',
    environment: env.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      'body.password',
      'body.refreshToken',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const requestId = req.headers['x-request-id']?.toString() || randomUUID();
    res.setHeader('X-Request-Id', requestId);
    return requestId;
  },
  customLogLevel(req, res, error) {
    if (error || res.statusCode >= 500) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.originalUrl} completed with ${res.statusCode}`;
  },
  customErrorMessage(req, res, error) {
    return `${req.method} ${req.originalUrl} failed with ${res.statusCode}: ${error.message}`;
  },
});
