import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from './errors.js';
import { query } from '../db/index.js';

function normalizeArgumentValue(argument) {
  if (
    argument
    && typeof argument === 'object'
    && !Array.isArray(argument)
    && Object.hasOwn(argument, 'type')
    && Object.hasOwn(argument, 'value')
  ) {
    if (argument.type === 'array') {
      return {
        cast: argument.sqlType ?? null,
        value: argument.value,
      };
    }

    if (argument.type === 'jsonb') {
      return {
        cast: 'jsonb',
        value: JSON.stringify(argument.value),
      };
    }
  }

  if (argument !== null && typeof argument === 'object') {
    return {
      cast: 'jsonb',
      value: JSON.stringify(argument),
    };
  }

  return {
    cast: null,
    value: argument,
  };
}

function buildInvocationSql(qualifiedName, args) {
  if (!args.length) {
    return `SELECT ${qualifiedName}() AS result;`;
  }

  const placeholders = args
    .map((argument, index) =>
      argument.cast ? `$${index + 1}::${argument.cast}` : `$${index + 1}`,
    )
    .join(', ');
  return `SELECT ${qualifiedName}(${placeholders}) AS result;`;
}

function mapFunctionFailure(qualifiedName, result) {
  const detail =
    (result && typeof result === 'object' && typeof result.message === 'string' && result.message) ||
    `The database function ${qualifiedName} rejected the request.`;
  const normalizedDetail = detail.toLowerCase();

  if (
    normalizedDetail.includes('not found')
    || normalizedDetail.includes('no permission')
    || normalizedDetail.includes('access denied')
  ) {
    if (normalizedDetail.includes('permission') || normalizedDetail.includes('access denied')) {
      return new ForbiddenError(detail);
    }

    return new NotFoundError(detail);
  }

  if (
    normalizedDetail.includes('already exists')
    || normalizedDetail.includes('already processed')
    || normalizedDetail.includes('already archived')
    || normalizedDetail.includes('already active')
    || normalizedDetail.includes('conflict')
  ) {
    return new ConflictError(detail);
  }

  return new BadRequestError(detail);
}

function mapDatabaseError(qualifiedName, error) {
  switch (error.code) {
    case '22P02':
    case '22007':
    case '22008':
    case '22023':
      return new BadRequestError(`Invalid arguments supplied for ${qualifiedName}.`);
    case '23503':
      return new BadRequestError(
        `The request for ${qualifiedName} references a record that does not exist.`,
      );
    case '23505':
      return new ConflictError(`The request for ${qualifiedName} conflicts with existing data.`);
    case '42501':
      return new ForbiddenError(`The database is not permitted to execute ${qualifiedName}.`);
    case '42883':
    case '42P01':
    case '3F000':
      return new ServiceUnavailableError(
        `The database contract for ${qualifiedName} is not installed or is incomplete.`,
      );
    default:
      return error;
  }
}

export async function executeJsonFunction(qualifiedName, args = []) {
  try {
    const normalizedArgs = args.map(normalizeArgumentValue);
    const result = await query(
      buildInvocationSql(qualifiedName, normalizedArgs),
      normalizedArgs.map((argument) => argument.value),
    );
    const payload = result.rows[0]?.result ?? null;

    if (payload && typeof payload === 'object' && payload.success === false) {
      throw mapFunctionFailure(qualifiedName, payload);
    }

    return payload;
  } catch (error) {
    throw mapDatabaseError(qualifiedName, error);
  }
}
