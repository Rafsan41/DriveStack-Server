import type { ParamsDictionary } from 'express-serve-static-core';
import { asyncHandler } from '../../core/asyncHandler';
import { sendSuccess } from '../../core/http';
import type { AuthService } from './auth.service';
import type { LoginRequestBody } from './auth.types';

/**
 * Handler properties are intentionally left un-annotated: `asyncHandler`
 * already returns a precisely-typed `RequestHandler<P, ResBody, ReqBody, ReqQuery>`,
 * and re-annotating them as the bare `RequestHandler` would widen `P` back to
 * `ParamsDictionary` and discard the body/query types.
 */
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  public readonly login = asyncHandler<ParamsDictionary, unknown, LoginRequestBody>(
    async (req, res) => {
      const result = await this.authService.login(req.body);
      sendSuccess(res, 200, 'Login successful.', result);
    },
  );
}
