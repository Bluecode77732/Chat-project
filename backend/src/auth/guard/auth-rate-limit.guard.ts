// 목적: 인증 이전 REST 시도(signin/register)를 클라이언트 IP 기준으로 rate-limit;
// chat의 RateLimitGuard와 달리 userId가 존재하기 전 단계에서 동작하므로 IP를 키로 사용.
// 사용처: AuthController의 signIn/register에 @UseGuards(AuthRateLimitGuard)로 적용.
// 근거: chat/guard/rate-limit.guard.ts는 인증된 userId를 키로 사용하는데 이 단계에서는
// 아직 userId가 없어 그대로 재사용할 수 없음.

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Request } from 'express';
import { logger } from 'src/base/logger/logger';

// 선택적 env(AUTH_RATE_LIMIT_WINDOW_SEC / AUTH_RATE_LIMIT_MAX_ATTEMPTS)로 오버라이드 가능 —
// CI e2e는 하나의 IP에서 윈도우 내 10회 이상 register/signin을 호출하므로, 프로덕션
// 기본값을 약화하지 않고도 제한을 완화할 수 있음.
const WINDOW_SEC = 60;
const MAX_ATTEMPTS = 10;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? 'unknown';
    const handlerName = context.getHandler().name;

    try {
      const windowSec = this.configService.get<number>(
        'AUTH_RATE_LIMIT_WINDOW_SEC',
        WINDOW_SEC,
      );
      const maxAttempts = this.configService.get<number>(
        'AUTH_RATE_LIMIT_MAX_ATTEMPTS',
        MAX_ATTEMPTS,
      );
      const key = `auth:${handlerName}-attempt:${ip}`;
      // Lua 스크립트로 INCR과 EXPIRE를 원자적으로 실행 —
      // 두 명령 사이에 서버가 죽어도 키가 영구히 남지 않도록 방지
      const luaScript = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], ${windowSec})
        end
        return count
      `;
      const count = (await this.redis.eval(luaScript, 1, key)) as number;

      if (count > maxAttempts) {
        logger.warn(
          `[ip=${ip}] Auth rate limit exceeded on ${handlerName} (count=${count})`,
        );
        throw new HttpException(
          'Too many attempts, please try again later',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err) {
      // 의도된 guard 예외는 다시 던져서 NestJS가 올바른 상태 코드를 전파하도록 함
      if (err instanceof HttpException) {
        throw err;
      }
      // 예상치 못한 에러(예: Redis 다운) → fail-closed
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? '') : '';
      logger.error(
        `[ip=${ip}] Auth rate limit guard error: ${errMessage}\n${errStack}`,
      );
      return false;
    }
  }
}
