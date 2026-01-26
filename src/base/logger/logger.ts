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
import { join } from "node:path";

// Logger configuration as singleton instance - can be implemented in app.module as well
export const logger = winston.createLogger({
    level: 'verbose',
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp({
                    format: "YYYY-MM-DD HH:mm:ss ZZ",
                    alias: "Activated timestamp",
                }),
                winston.format.printf(info => `${info.timestamp} | ${info.level} | ${info.message}`),
            ),
        }),
        new winston.transports.File({
            format: winston.format.combine(
                winston.format.timestamp({
                    format: "YYYY-MM-DD HH:mm:ss ZZ",
                    alias: "Logs timestamp",
                }),
                winston.format.printf(info => `${info.timestamp} | ${info.level} | ${info.message}`),
            ),
            dirname: join(process.cwd(), "logs"),
            filename: "logs.log",
        }),
        new winston.transports.File({
            format: winston.format.combine(
                winston.format.timestamp({
                    format: "YYYY-MM-DD HH:mm:ss ZZ",
                    alias: "Error timestamp",
                }),
                winston.format.printf(info => `${info.timestamp} | ${info.level} | ${info.message}`),
            ),
            dirname: join(process.cwd(), "logs"),
            level: "error",
            filename: "error.logs.log",
        }),
    ],
});
