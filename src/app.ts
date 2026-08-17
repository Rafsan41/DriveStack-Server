import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { apiRouter } from './routes';

export function createApp(): Application {
  const app = express();

  // Required for express-rate-limit to see the real client IP when the API sits
  // behind a single reverse proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Vehicle photos are served from this origin and consumed by a browser
      // client on another one; the default `same-origin` policy would block them.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // Locally stored vehicle photos, e.g. GET /uploads/vehicle-1712345678-ab12cd.jpg
  app.use(
    `/${env.upload.dir}`,
    express.static(env.upload.absoluteDir, {
      index: false,
      maxAge: env.isProduction ? '7d' : 0,
      // Never let a stray file in the upload folder render as same-origin content.
      setHeaders: (res) => res.setHeader('Content-Disposition', 'inline'),
    }),
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Vehicle Rental API is running.',
      data: { status: 'ok', environment: env.nodeEnv, timestamp: new Date().toISOString() },
    });
  });

  // Mounted at the root so the paths match the spec exactly: /auth/login,
  // /vehicles, /rentals, /reports.
  app.use('/', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
