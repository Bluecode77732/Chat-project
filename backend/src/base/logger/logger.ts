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

const isVercel = process.env.VERCEL === '1';
const level =
  process.env.LOG_LEVEL ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

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
    ...(!isVercel
      ? [
          new winston.transports.File({
            format: winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss ZZ' }),
              winston.format.printf(
                (info) =>
                  `${String(info.timestamp)} | ${String(info.level)} | ${String(info.message)}`,
              ),
            ),
            dirname: join(process.cwd(), 'logs'),
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
            dirname: join(process.cwd(), 'logs'),
            level: 'error',
            filename: 'error.logs.log',
          }),
        ]
      : []),
  ],
});
