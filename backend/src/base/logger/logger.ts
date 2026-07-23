// Winston npm log levels (lower number = higher priority)
/**
 * error   (0)
 * warn    (1)
 * info    (2)
 * http    (3)
 * verbose (4)
 * debug   (5)
 * silly   (6)
 *
 * LOG_LEVEL env var overrides the default.
 * Default: 'debug' in development, 'info' in production.
 */

import * as winston from 'winston';
import { join } from 'node:path';

const level =
  process.env.LOG_LEVEL ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Railway injects RAILWAY_VOLUME_MOUNT_PATH at container start once a volume
// is attached to this service (see railway.toml). Falls back to the local
// ./logs dir when unset (local dev, CI, or no volume attached) so behavior
// off Railway is unchanged.
const logDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'logs')
  : join(process.cwd(), 'logs');

export const logger = winston.createLogger({
  level,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss ZZ' }),
        winston.format.printf(
          (info) =>
            `${String(info.timestamp)} | ${String(info.level)} | ${String(info.message)}`,
        ),
      ),
    }),
    new winston.transports.File({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss ZZ' }),
        winston.format.printf(
          (info) =>
            `${String(info.timestamp)} | ${String(info.level)} | ${String(info.message)}`,
        ),
      ),
      dirname: logDir,
      filename: 'logs.log',
    }),
    new winston.transports.File({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss ZZ' }),
        winston.format.printf(
          (info) =>
            `${String(info.timestamp)} | ${String(info.level)} | ${String(info.message)}`,
        ),
      ),
      dirname: logDir,
      level: 'error',
      filename: 'error.logs.log',
    }),
  ],
});
