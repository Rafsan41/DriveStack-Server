import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';

/**
 * Express 4 does not catch rejected promises from async handlers — an unhandled
 * rejection would hang the request instead of reaching the error middleware.
 * Every async controller method is wrapped in this.
 *
 * The generic defaults mirror Express's own, so a handler that only narrows the
 * body still lines up with `Router.get`/`post` overloads.
 */
export function asyncHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Query,
>(
  handler: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
