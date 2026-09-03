import * as winston from 'winston';
import { join } from 'node:path';

const level =
  process.env.LOG_LEVEL ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Railway는 이 서비스에 볼륨이 연결되면 컨테이너 시작 시 RAILWAY_VOLUME_MOUNT_PATH를
// 주입(railway.toml 참고). 미설정 시(로컬 개발, CI, 볼륨 미연결) 로컬 ./logs 디렉터리로
// 폴백 — Railway 밖에서는 동작이 그대로 유지됨.
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
