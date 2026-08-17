import type { RequestHandler } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import type Joi from 'joi';
import { ValidationError } from '../core/ApiError';
import type { ValidationIssue } from '../core/http';

type RequestSegment = 'body' | 'query' | 'params';

export type ValidationSchemas = Partial<Record<RequestSegment, Joi.Schema>>;

/**
 * Validates any combination of params / query / body against Joi schemas and
 * replaces the segment with the *coerced* result, so downstream handlers get
 * real numbers and trimmed strings rather than raw query strings.
 *
 * All segments are checked before failing, so a bad request reports every
 * problem at once instead of one per round trip.
 *
 * Generic in the same four parameters as `RequestHandler` so that, on a route
 * like `get('/:id', validate(...), controller.getById)`, TypeScript can unify
 * this middleware with the narrowly-typed controller handler beside it.
 */
export function validate<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Query,
>(schemas: ValidationSchemas): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  const segments = Object.keys(schemas) as RequestSegment[];

  return (req, _res, next) => {
    const issues: ValidationIssue[] = [];

    for (const segment of segments) {
      const schema = schemas[segment];
      if (!schema) continue;

      const { value, error } = schema.validate(req[segment], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        issues.push(
          ...error.details.map((detail) => ({
            field: detail.path.join('.') || segment,
            message: detail.message.replace(/"/g, "'"),
          })),
        );
        continue;
      }

      // `req.query` is a lazy getter on the Express prototype, so a plain
      // assignment is unreliable. defineProperty replaces it cleanly.
      Object.defineProperty(req, segment, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    if (issues.length > 0) {
      next(new ValidationError('Request validation failed.', issues));
      return;
    }

    next();
  };
}
