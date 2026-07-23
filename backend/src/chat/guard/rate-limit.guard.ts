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
      // Lua script ensures INCR and EXPIRE execute atomically —
      // prevents a permanent key if the server crashes between the two commands
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
        // Feed the velocity violation into the moderation strike ladder. Self-guarded and
        // idempotent per 15s window (NX marker), so it never blocks the rate-limit decision.
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
      // Re-throw intentional guard exceptions so NestJS propagates the correct status
      if (err instanceof WsException || err instanceof HttpException) {
        throw err;
      }
      // Unexpected errors (e.g. Redis down) → fail-closed
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? '') : '';
      logger.error(
        `[user=${userId ?? 'unknown'}] Rate limit guard error: ${errMessage}\n${errStack}`,
      );
      return false;
    }
  }
}
