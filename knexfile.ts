/**
 * Entry point for the Knex CLI (`npm run db:migrate`, `db:seed`, ...).
 *
 * The connection settings live in `src/database/connection.ts` so the app and the
 * CLI can never drift apart. Because the compiled tree mirrors the source tree
 * (`dist/src/database/...`), the directory below resolves correctly whether this
 * file runs as `knexfile.ts` from the project root or as `dist/knexfile.js`.
 */
import path from 'node:path';
import type { Knex } from 'knex';
import { knexConfig } from './src/database/connection';

const databaseDir = path.join(__dirname, 'src', 'database');

const environmentConfig: Knex.Config = {
  ...knexConfig,
  migrations: {
    ...knexConfig.migrations,
    directory: path.join(databaseDir, 'migrations'),
  },
  seeds: {
    ...knexConfig.seeds,
    directory: path.join(databaseDir, 'seeds'),
  },
};

const config: Record<string, Knex.Config> = {
  development: environmentConfig,
  test: environmentConfig,
  production: environmentConfig,
};

export default config;
