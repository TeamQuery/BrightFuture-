import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { ForbiddenError } from './lib/errors.js';
import { httpLogger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { ipRateLimiter } from './middleware/rate-limit.js';
import academicRoutes from './routes/academic.js';
import authRoutes from './routes/auth.js';
import financeRoutes from './routes/finance.js';
import functionRoutes from './routes/functions.js';
import gradesRoutes from './routes/grades.js';
import healthRoutes from './routes/health.js';
import libraryRoutes from './routes/library.js';
import studentsRoutes from './routes/students.js';
import teachersRoutes from './routes/teachers.js';
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
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());
app.use(ipRateLimiter);

app.use('/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/v1/academic', academicRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/v1/finance', financeRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/v1/grades', gradesRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/v1/library', libraryRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/v1/students', studentsRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/v1/teachers', teachersRoutes);
app.use('/api/staff', teachersRoutes);
app.use('/api/v1/staff', teachersRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api/v1/functions', functionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/v1/users', userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
