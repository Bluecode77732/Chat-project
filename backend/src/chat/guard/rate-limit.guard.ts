import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { GqlExecutionContext } from '@nestjs/graphql';
import Redis from 'ioredis';
import { logger } from 'src/base/logger/logger';
import { ModerationService } from 'src/moderation/moderation.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly moderationService: ModerationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isWs = context.getType() === 'ws';
    let userId: number | undefined;
    try {
      if (isWs) {
        const client = context
          .switchToWs()
          .getClient<{ data: { user?: { sub?: number } } }>();
        userId = client.data.user?.sub;
      } else {
        const gqlCtx = GqlExecutionContext.create(context).getContext<{
          req?: { user?: { id?: number } };
        }>();
        userId = gqlCtx.req?.user?.id;
      }

      if (!userId) {
        if (isWs) throw new WsException('Cannot Find User Id');
        throw new HttpException('Cannot Find User Id', HttpStatus.UNAUTHORIZED);
      }

      const key = `rate_limit:${userId}`;
      // Lua 스크립트로 INCR과 EXPIRE를 원자적으로 실행 —
      // 두 명령 사이에 서버가 크래시해도 영구 key가 남지 않도록 방지
      const luaScript = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], 15)
        end
        return count
      `;
      const count = (await this.redis.eval(luaScript, 1, key)) as number;

      if (count > 10) {
        logger.warn(`[user=${userId}] Rate limit exceeded (count=${count})`);
        // velocity 위반을 moderation strike ladder에 반영. 15초 윈도우당 자체 가드 +
        // 멱등(NX marker)이라 rate-limit 판정을 절대 막지 않음.
        await this.moderationService.recordVelocityViolation(userId);
        if (isWs) throw new WsException('Rate limit exceeded');
        throw new HttpException(
          'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      logger.debug(`${userId} left message count: '${10 - count}'`);
      return true;
    } catch (err) {
      // 의도된 guard 예외는 그대로 재던져서 NestJS가 올바른 status를 전파하도록 함
      if (err instanceof WsException || err instanceof HttpException) {
        throw err;
      }
      // 예상치 못한 에러(예: Redis 다운) → fail-closed
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? '') : '';
      logger.error(
        `[user=${userId ?? 'unknown'}] Rate limit guard error: ${errMessage}\n${errStack}`,
      );
      return false;
    }
  }
}
