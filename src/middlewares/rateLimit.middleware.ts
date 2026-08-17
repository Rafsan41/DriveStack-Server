import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import type { ApiErrorBody } from '../core/http';

const tooManyRequestsBody: ApiErrorBody = {
  success: false,
  message: 'Too many login attempts from this IP. Please try again later.',
  code: 'TOO_MANY_REQUESTS',
};

/**
 * Bonus requirement: basic rate limiting on POST /auth/login, to blunt
 * credential stuffing. Counts only failed attempts so a legitimate user who
 * logs in repeatedly is never locked out.
 */
export const loginRateLimiter = rateLimit({
  windowMs: env.loginRateLimit.windowMs,
  limit: env.loginRateLimit.maxAttempts,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: tooManyRequestsBody,
});
