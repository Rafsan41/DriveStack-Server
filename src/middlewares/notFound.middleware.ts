import type { RequestHandler } from 'express';
import { NotFoundError } from '../core/ApiError';

/** Mounted last, so any unmatched route produces the same JSON shape as everything else. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} does not exist.`));
};
