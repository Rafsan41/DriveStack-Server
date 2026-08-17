import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';
import multer from 'multer';
import { env } from '../config/env';
import { BadRequestError } from '../core/ApiError';

/**
 * The extension is derived from the *mime type*, never from the client-supplied
 * filename — that removes path traversal and double-extension tricks entirely.
 */
const EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(env.upload.absoluteDir, { recursive: true });
    cb(null, env.upload.absoluteDir);
  },
  filename: (_req, file, cb) => {
    const extension = EXTENSION_BY_MIME[file.mimetype] ?? '';
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `vehicle-${unique}${extension}`);
  },
});

/** Accepts a single optional `photo` field on multipart/form-data requests. */
const singlePhotoHandler = multer({
  storage,
  limits: {
    fileSize: env.upload.maxSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!(file.mimetype in EXTENSION_BY_MIME)) {
      cb(
        new BadRequestError(
          `Unsupported image type '${file.mimetype}'. Allowed: ${Object.keys(EXTENSION_BY_MIME).join(', ')}.`,
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single('photo');

/**
 * Multer types its middleware as the bare `RequestHandler`, which would pin a
 * route's params generic to `ParamsDictionary` and clash with a controller that
 * types `:id` as a number. This wrapper re-exposes it with the same generics as
 * `RequestHandler` so route-level inference still works.
 *
 * The cast is safe by construction: Multer only reads the request stream and
 * writes `req.file` / `req.body`; it never inspects `req.params` or `req.query`.
 */
export function uploadVehiclePhoto<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Query,
>(): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return singlePhotoHandler as unknown as RequestHandler<P, ResBody, ReqBody, ReqQuery>;
}

/** Public, storable path for a freshly uploaded file, e.g. `uploads/vehicle-…jpg`. */
export function toStoredPhotoPath(file: Express.Multer.File): string {
  return path.posix.join(env.upload.dir, file.filename);
}

/**
 * Best-effort removal of a stored photo — used when a vehicle's photo is
 * replaced or when a request fails after Multer already wrote the file.
 * A missing file is not an error worth surfacing.
 */
export async function removeStoredPhoto(storedPath: string | null | undefined): Promise<void> {
  if (!storedPath) return;

  const absolute = path.resolve(process.cwd(), storedPath);

  // Refuse to unlink anything outside the configured upload directory, however
  // the stored value got there.
  const uploadRoot = path.resolve(env.upload.absoluteDir);
  if (!absolute.startsWith(uploadRoot + path.sep)) return;

  try {
    await fsp.unlink(absolute);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      console.warn(`[uploads] could not remove ${storedPath}:`, error);
    }
  }
}
