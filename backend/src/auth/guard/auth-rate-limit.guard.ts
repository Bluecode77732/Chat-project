// Purpose: rate-limits pre-authentication REST attempts (signin/register) by client IP;
// unlike chat's RateLimitGuard this runs before a userId exists to key off.
// Usage: applied via @UseGuards(AuthRateLimitGuard) on AuthController's signIn/register.
// Rationale: chat/guard/rate-limit.guard.ts keys off an authenticated userId that isn't
// available at this stage, so its logic couldn't be reused as-is.

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

// Overridable via optional env (AUTH_RATE_LIMIT_WINDOW_SEC / AUTH_RATE_LIMIT_MAX_ATTEMPTS)
// so CI e2e — which drives >10 register/signin calls from one IP inside the window —
// can relax the limit without weakening the production default.
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
      // Lua script ensures INCR and EXPIRE execute atomically —
      // prevents a permanent key if the server crashes between the two commands
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
      // Re-throw intentional guard exceptions so NestJS propagates the correct status
      if (err instanceof HttpException) {
        throw err;
      }
      // Unexpected errors (e.g. Redis down) → fail-closed
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? '') : '';
      logger.error(
        `[ip=${ip}] Auth rate limit guard error: ${errMessage}\n${errStack}`,
      );
      return false;
    }
  }
}
