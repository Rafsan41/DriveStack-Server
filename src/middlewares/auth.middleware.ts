import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../core/ApiError';
import type { AuthenticatedStaff, JwtStaffPayload } from '../modules/auth/auth.types';

/**
 * Verifies the Bearer token and attaches the decoded staff member to the request.
 * Mounted on every /vehicles, /rentals and /reports route (spec §3).
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError(
      'Missing or malformed Authorization header. Expected "Bearer <token>".',
    );
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Bearer token is empty.');
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtStaffPayload;
    req.staff = {
      id: Number(payload.sub),
      email: payload.email,
      name: payload.name,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token has expired. Please log in again.');
    }
    throw new UnauthorizedError('Invalid authentication token.');
  }
};

/**
 * Narrows `req.staff` from `AuthenticatedStaff | undefined` to `AuthenticatedStaff`.
 * Lets controllers behind `authenticate` read the staff member without a `!`.
 */
export function requireStaff(req: Request): AuthenticatedStaff {
  if (!req.staff) {
    throw new UnauthorizedError('Authentication required.');
  }
  return req.staff;
}
