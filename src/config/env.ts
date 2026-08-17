import path from 'node:path';
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

/**
 * Every environment value the app needs, already coerced to its real type.
 * Nothing else in the codebase reads `process.env` directly — if it isn't here,
 * it isn't configurable.
 */
export interface AppEnv {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;

  db: {
    /**
     * Full connection string, when one is supplied (e.g. a Neon/managed URL).
     * Takes precedence over the discrete host/port/user fields below.
     */
    url?: string;
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
    /** SSL is required by most managed Postgres providers (Neon, Supabase, RDS). */
    ssl: boolean;
    poolMin: number;
    poolMax: number;
  };

  jwt: {
    secret: string;
    expiresIn: string;
  };

  bcryptSaltRounds: number;

  upload: {
    /** Path segment as configured, e.g. `uploads`. Used to build public URLs. */
    dir: string;
    /** Absolute path on disk where Multer writes files. */
    absoluteDir: string;
    maxSizeBytes: number;
  };

  loginRateLimit: {
    windowMs: number;
    maxAttempts: number;
  };
}

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),

  // A full connection string, if supplied, is authoritative and makes the
  // discrete DB_* fields optional. Otherwise host/user/name are required.
  DB_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional(),
  DB_HOST: Joi.string().hostname().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().when('DB_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().when('DB_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MIN: Joi.number().integer().min(0).default(2),
  DB_POOL_MAX: Joi.number().integer().min(1).default(10),

  // A short secret is the single most common way a JWT setup gets broken, so it
  // is a hard startup failure rather than a warning.
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters long',
  }),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),

  UPLOAD_DIR: Joi.string().default('uploads'),
  MAX_UPLOAD_SIZE_MB: Joi.number().positive().default(5),

  LOGIN_RATE_LIMIT_WINDOW_MINUTES: Joi.number().positive().default(15),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: Joi.number().integer().positive().default(5),
})
  .unknown(true)
  .required();

interface RawEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DB_URL?: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER?: string;
  DB_PASSWORD: string;
  DB_NAME?: string;
  DB_SSL: boolean;
  DB_POOL_MIN: number;
  DB_POOL_MAX: number;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;
  UPLOAD_DIR: string;
  MAX_UPLOAD_SIZE_MB: number;
  LOGIN_RATE_LIMIT_WINDOW_MINUTES: number;
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: number;
}

const { value, error } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false,
});

if (error) {
  const details = error.details.map((d) => `  - ${d.message}`).join('\n');
  throw new Error(
    `Invalid environment configuration. Check your .env against .env.example:\n${details}`,
  );
}

const raw = value as RawEnv;

export const env: AppEnv = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  port: raw.PORT,

  db: {
    url: raw.DB_URL,
    host: raw.DB_HOST,
    port: raw.DB_PORT,
    user: raw.DB_USER ?? 'postgres',
    password: raw.DB_PASSWORD,
    name: raw.DB_NAME ?? 'vehicle_rental',
    // Managed URLs (Neon etc.) require TLS. Honour an explicit DB_SSL, and also
    // infer it from an `sslmode=require` in the connection string.
    ssl: raw.DB_SSL || (raw.DB_URL !== undefined && /sslmode=require/i.test(raw.DB_URL)),
    poolMin: raw.DB_POOL_MIN,
    poolMax: raw.DB_POOL_MAX,
  },

  jwt: {
    secret: raw.JWT_SECRET,
    expiresIn: raw.JWT_EXPIRES_IN,
  },

  bcryptSaltRounds: raw.BCRYPT_SALT_ROUNDS,

  upload: {
    dir: raw.UPLOAD_DIR,
    absoluteDir: path.resolve(process.cwd(), raw.UPLOAD_DIR),
    maxSizeBytes: Math.round(raw.MAX_UPLOAD_SIZE_MB * 1024 * 1024),
  },

  loginRateLimit: {
    windowMs: raw.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    maxAttempts: raw.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  },
};
