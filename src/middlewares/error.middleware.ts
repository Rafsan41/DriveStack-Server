import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { ApiError } from '../core/ApiError';
import type { ApiErrorBody, ValidationIssue } from '../core/http';
import { removeStoredPhoto, toStoredPhotoPath } from './upload.middleware';

/** Postgres SQLSTATE codes we can translate into a meaningful HTTP status. */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_CHECK_VIOLATION = '23514';

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

interface NormalisedError {
  statusCode: number;
  code: string;
  message: string;
  errors?: ValidationIssue[];
  details?: unknown;
}

function normalise(error: unknown): NormalisedError {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      errors: Array.isArray(error.details) ? (error.details as ValidationIssue[]) : undefined,
      details: Array.isArray(error.details) ? undefined : error.details,
    };
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: `Uploaded photo exceeds the ${Math.round(env.upload.maxSizeBytes / 1024 / 1024)} MB limit.`,
      };
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return {
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: `Unexpected file field '${error.field}'. Use the 'photo' field.`,
      };
    }
    return { statusCode: 400, code: 'BAD_REQUEST', message: error.message };
  }

  const pgError = error as PostgresError;
  switch (pgError.code) {
    case PG_UNIQUE_VIOLATION:
      return {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'A record with these unique values already exists.',
        details: { constraint: pgError.constraint },
      };
    case PG_FOREIGN_KEY_VIOLATION:
      return {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Operation violates a foreign key constraint.',
        details: { constraint: pgError.constraint },
      };
    case PG_CHECK_VIOLATION:
      return {
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Operation violates a database check constraint.',
        details: { constraint: pgError.constraint },
      };
    default:
      break;
  }

  // Malformed JSON from body-parser.
  if (error instanceof SyntaxError && 'body' in error) {
    return { statusCode: 400, code: 'BAD_REQUEST', message: 'Request body is not valid JSON.' };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  };
}

/**
 * Terminal error handler. Also cleans up the orphaned upload that Multer has
 * already written to disk when the request fails after the file was accepted.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const normalised = normalise(error);

  if (req.file) {
    void removeStoredPhoto(toStoredPhotoPath(req.file));
  }

  if (normalised.statusCode >= 500) {
    console.error('[error]', req.method, req.originalUrl, error);
  }

  const body: ApiErrorBody = {
    success: false,
    message: normalised.message,
    code: normalised.code,
  };

  if (normalised.errors?.length) body.errors = normalised.errors;
  if (normalised.details !== undefined) body.details = normalised.details;

  // Stack traces are useful locally and a liability in production.
  if (!env.isProduction && normalised.statusCode >= 500 && error instanceof Error) {
    body.details = { stack: error.stack };
  }

  res.status(normalised.statusCode).json(body);
};
