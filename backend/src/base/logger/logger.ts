// Log Level Priority
/**
 * fatal
 * warn
 * error
 * debug
 * log
 * verbose
 */

import * as winston from 'winston';
import { join } from 'node:path';

// Debug: Deployment on Vercel; for deploying frontend on read-only serverless Vercel
const isVercel = process.env.VERCEL === '1';

// Logger configuration as singleton instance - can be implemented in app.module as well
export const logger = winston.createLogger({
  level: 'verbose',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss ZZ',
          alias: 'Activated timestamp',
        }),
        winston.format.printf(
          (info) => `${info.timestamp} | ${info.level} | ${info.message}`,
        ),
      ),
    }),
    // Debug: Deployment on Vercel; Spread the File Transports into local and Vercel for differ the OS to apply different transport
    ...(!isVercel ? [
      new winston.transports.File({
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss ZZ',
            alias: 'Logs timestamp',
          }),
          winston.format.printf(
            (info) => `${info.timestamp} | ${info.level} | ${info.message}`,
          ),
        ),
        // Debug: Deployment on Vercel; This line causes the Vercel ENOENT error
        dirname: join(process.cwd(), 'logs'),
        filename: 'logs.log',
      }),
      new winston.transports.File({
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss ZZ',
            alias: 'Error timestamp',
          }),
          winston.format.printf(
            (info) => `${info.timestamp} | ${info.level} | ${info.message}`,
          ),
        ),
        dirname: join(process.cwd(), 'logs'),
        level: 'error',
        filename: 'error.logs.log',
      }),
    ] : []),
  ],
});
