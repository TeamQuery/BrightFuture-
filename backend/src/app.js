import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { ForbiddenError } from './lib/errors.js';
import { httpLogger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { ipRateLimiter } from './middleware/rate-limit.js';
import authRoutes from './routes/auth.js';
import functionRoutes from './routes/functions.js';
import healthRoutes from './routes/health.js';
import userRoutes from './routes/users.js';

const app = express();

app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');

app.use(httpLogger);
app.use(
  helmet({
    referrerPolicy: {
      policy: 'no-referrer',
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new ForbiddenError('Request origin is not included in the CORS allowlist.'),
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }),
);
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(cookieParser());
app.use(ipRateLimiter);

app.use('/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api/v1/functions', functionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v1/users', userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
