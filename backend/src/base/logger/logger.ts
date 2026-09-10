// Winston npm 로그 레벨(숫자가 낮을수록 우선순위가 높음)
/**
 * error   (0)
 * warn    (1)
 * info    (2)
 * http    (3)
 * verbose (4)
 * debug   (5)
 * silly   (6)
 *
 * LOG_LEVEL 환경 변수가 기본값을 덮어씀.
 * 기본값: 개발 환경에서는 'debug', 운영 환경에서는 'info'.
 */

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
