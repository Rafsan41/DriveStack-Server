import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { assertDatabaseConnection, closeDatabaseConnection } from './database/connection';

async function bootstrap(): Promise<void> {
  // Fail loudly at boot instead of on the first request.
  await assertDatabaseConnection();
  console.log(`[db] connected to ${env.db.name} at ${env.db.host}:${env.db.port}`);

  const app = createApp();
  const server: Server = app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  registerShutdownHandlers(server);
}

function registerShutdownHandlers(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[server] ${signal} received, shutting down gracefully...`);

    server.close(() => {
      void closeDatabaseConnection()
        .then(() => {
          console.log('[server] closed cleanly');
          process.exit(0);
        })
        .catch((error: unknown) => {
          console.error('[server] error while closing the database pool', error);
          process.exit(1);
        });
    });

    // Don't let in-flight requests hold the process open forever.
    setTimeout(() => {
      console.error('[server] forced shutdown after 10s timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('[process] unhandled promise rejection:', reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('[process] uncaught exception:', error);
    process.exit(1);
  });
}

void bootstrap().catch((error: unknown) => {
  console.error('[server] failed to start:', error);
  process.exit(1);
});
