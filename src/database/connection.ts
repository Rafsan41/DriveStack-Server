import knex, { type Knex } from 'knex';
import pg from 'pg';
import { env } from '../config/env';

/**
 * pg's default type parsers are wrong for this schema in two places, and both
 * would produce subtly incorrect data rather than an error:
 *
 *  - DATE: pg builds a JS `Date` at *local* midnight. In any non-UTC timezone
 *    serialising that back to JSON shifts the day (e.g. `2025-08-01` becomes
 *    `2025-07-31T18:00:00Z` in UTC+6). `start_date` / `end_date` are date-only
 *    columns, so we keep them as the raw 'YYYY-MM-DD' string and never let a
 *    timezone touch them. This is what makes the overlap and report queries
 *    trustworthy.
 *  - NUMERIC: pg returns a string to protect precision. `daily_rate` and
 *    `total_amount` fit comfortably in a double, so we parse them to numbers and
 *    keep the JSON contract numeric.
 *
 * INT8 (bigint) is parsed too, because `COUNT(*)` comes back as int8.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value: string) => Number.parseFloat(value));
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number.parseInt(value, 10));

/**
 * A managed provider needs TLS but presents a certificate this client has no
 * local CA for, so we enable SSL without hard-failing on the chain. The
 * connection is still encrypted; we simply don't pin the CA.
 */
const sslOption = env.db.ssl ? { rejectUnauthorized: false } : false;

// Prefer a full connection string when one is configured (Neon, RDS, etc.);
// otherwise assemble the connection from the discrete DB_* fields.
const connection: Knex.PgConnectionConfig = env.db.url
  ? { connectionString: env.db.url, ssl: sslOption }
  : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      ssl: sslOption,
    };

export const knexConfig: Knex.Config = {
  client: 'pg',
  connection,
  pool: {
    min: env.db.poolMin,
    max: env.db.poolMax,
  },
  migrations: {
    directory: `${__dirname}/migrations`,
    tableName: 'knex_migrations',
    extension: 'ts',
    loadExtensions: ['.ts', '.js'],
  },
  seeds: {
    directory: `${__dirname}/seeds`,
    extension: 'ts',
    loadExtensions: ['.ts', '.js'],
  },
  asyncStackTraces: !env.isProduction,
};

export const db: Knex = knex(knexConfig);

/** Fail fast at boot rather than on the first request. */
export async function assertDatabaseConnection(): Promise<void> {
  await db.raw('SELECT 1');
}

export async function closeDatabaseConnection(): Promise<void> {
  await db.destroy();
}
