import { formatZodIssues, ValidationError } from '../lib/errors.js';

export function validate(schemas) {
  return function validationMiddleware(req, _res, next) {
    try {
      if (schemas.body) {
        const bodyResult = schemas.body.safeParse(req.body);
        if (!bodyResult.success) {
          throw new ValidationError(
            'Request body validation failed.',
            formatZodIssues(bodyResult.error.issues),
          );
        }
        req.body = bodyResult.data;
      }

      if (schemas.params) {
        const paramsResult = schemas.params.safeParse(req.params);
        if (!paramsResult.success) {
          throw new ValidationError(
            'Request parameter validation failed.',
            formatZodIssues(paramsResult.error.issues),
          );
        }
        req.params = paramsResult.data;
      }

      if (schemas.query) {
        const queryResult = schemas.query.safeParse(req.query);
        if (!queryResult.success) {
          throw new ValidationError(
            'Request query validation failed.',
            formatZodIssues(queryResult.error.issues),
          );
        }
        req.query = queryResult.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
