const PROBLEM_BASE = 'https://brightfuture.local/problems';

export class AppError extends Error {
  constructor({
    type = 'about:blank',
    title = 'Internal Server Error',
    status = 500,
    detail = 'An unexpected error occurred.',
    errors,
    headers,
    expose,
  }) {
    super(detail);
    this.name = 'AppError';
    this.type = type;
    this.title = title;
    this.status = status;
    this.detail = detail;
    this.errors = errors;
    this.headers = headers;
    this.expose = expose ?? status < 500;
  }
}

export class ValidationError extends AppError {
  constructor(detail, errors) {
    super({
      type: `${PROBLEM_BASE}/validation-error`,
      title: 'Validation Error',
      status: 400,
      detail,
      errors,
    });
  }
}

export class BadRequestError extends AppError {
  constructor(detail = 'The request could not be processed.') {
    super({
      type: `${PROBLEM_BASE}/bad-request`,
      title: 'Bad Request',
      status: 400,
      detail,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = 'Authentication is required to access this resource.') {
    super({
      type: `${PROBLEM_BASE}/unauthorized`,
      title: 'Unauthorized',
      status: 401,
      detail,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'You do not have permission to perform this action.') {
    super({
      type: `${PROBLEM_BASE}/forbidden`,
      title: 'Forbidden',
      status: 403,
      detail,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(detail = 'The requested resource was not found.') {
    super({
      type: `${PROBLEM_BASE}/not-found`,
      title: 'Not Found',
      status: 404,
      detail,
    });
  }
}

export class ConflictError extends AppError {
  constructor(detail = 'The request conflicts with the current resource state.') {
    super({
      type: `${PROBLEM_BASE}/conflict`,
      title: 'Conflict',
      status: 409,
      detail,
    });
  }
}

export class RateLimitError extends AppError {
  constructor(detail = 'Rate limit exceeded. Please try again later.', retryAfter) {
    super({
      type: `${PROBLEM_BASE}/rate-limit`,
      title: 'Too Many Requests',
      status: 429,
      detail,
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
    });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(detail = 'A required dependency is currently unavailable.') {
    super({
      type: `${PROBLEM_BASE}/service-unavailable`,
      title: 'Service Unavailable',
      status: 503,
      detail,
    });
  }
}

export function formatZodIssues(issues) {
  return issues.reduce((accumulator, issue) => {
    const field = issue.path.length ? issue.path.join('.') : 'root';
    accumulator[field] ??= [];
    accumulator[field].push(issue.message);
    return accumulator;
  }, {});
}
