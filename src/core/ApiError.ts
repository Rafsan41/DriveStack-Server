/**
 * Errors the application throws on purpose. `error.middleware.ts` turns these
 * into clean JSON; anything that is *not* an ApiError is treated as a bug and
 * reported as a generic 500 without leaking internals.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  /** Distinguishes "expected" failures from genuine crashes. */
  public readonly isOperational = true;

  constructor(statusCode: number, message: string, code: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, new.target);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, message, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(422, message, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(401, message, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, message, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, message, 'NOT_FOUND', details);
  }
}

/** Used for the double-booking case and for duplicate plate numbers. */
export class ConflictError extends ApiError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, message, 'CONFLICT', details);
  }
}

export class PayloadTooLargeError extends ApiError {
  constructor(message = 'Payload too large', details?: unknown) {
    super(413, message, 'PAYLOAD_TOO_LARGE', details);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(429, message, 'TOO_MANY_REQUESTS', details);
  }
}
