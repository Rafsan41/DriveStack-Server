import path from 'node:path';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { renderHealthPage } from './http/healthPage';
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

  // Content-negotiated: a browser gets the themed status page, while fetch/curl
  // and monitoring keep the JSON contract. `?format=json` forces JSON in a browser.
  app.get('/health', (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    const forceJson = req.query.format === 'json';
    const wantsHtml = !forceJson && req.accepts(['json', 'html']) === 'html';

    if (wantsHtml) {
      res
        .status(200)
        .type('html')
        .send(
          renderHealthPage({
            status: 'ok',
            environment: env.nodeEnv,
            timestamp,
            uptimeSeconds: process.uptime(),
            node: process.version,
          }),
        );
      return;
    }

    res.status(200).json({
      success: true,
      message: 'DriveStack API is running.',
      data: { status: 'ok', environment: env.nodeEnv, timestamp },
    });
  });

  // Landing page ("server interface") served from /public. Its CSS/JS are same
  // origin, so Helmet's default CSP allows them without relaxation. Unmatched
  // paths (e.g. /auth/login) fall through to the API router below.
  app.use(
    express.static(path.resolve(process.cwd(), 'public'), {
      index: 'index.html',
      maxAge: env.isProduction ? '1h' : 0,
    }),
  );

  // Mounted at the root so the paths match the spec exactly: /auth/login,
  // /vehicles, /rentals, /reports.
  app.use('/', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
