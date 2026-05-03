import { env } from '../config/env.js';
import { AppError, NotFoundError } from '../lib/errors.js';

export function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} was not found.`));
}

export function errorHandler(error, req, res, _next) {
  const appError =
    error instanceof AppError
      ? error
      : new AppError({
          detail:
            env.NODE_ENV === 'development'
              ? error.message
              : 'An unexpected internal error occurred.',
        });

  if (appError.headers) {
    for (const [header, value] of Object.entries(appError.headers)) {
      res.setHeader(header, value);
    }
  }

  if (appError.status >= 500) {
    req.log?.error({ error }, 'Unhandled application error.');
  }

  const response = {
    type: appError.type,
    title: appError.title,
    status: appError.status,
    detail: appError.expose ? appError.detail : 'An unexpected internal error occurred.',
    instance: req.originalUrl,
    traceId: req.id,
  };

  if (appError.errors) {
    response.errors = appError.errors;
  }

  res
    .status(appError.status)
    .type('application/problem+json')
    .json(response);
}
