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
import * as RedisClient from 'redis';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: RedisClient.RedisClientType,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isWs = context.getType() === 'ws';
    try {
      let userId: number | undefined;

      if (isWs) {
        const client = context.switchToWs().getClient();
        userId = client.data.user.sub;
      } else {
        const gqlCtx = GqlExecutionContext.create(context).getContext();
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
          redis.call('EXPIRE', KEYS[1], 60)
        end
        return count
      `;
      const count = (await this.redis.eval(luaScript, {
        keys: [key],
      })) as number;

      if (count > 10) {
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
      logger.error(
        `[user=${userId ?? 'unknown'}] Rate limit guard error: ${(err as Error).message}\n${(err as Error).stack ?? ''}`,
      );
      return false;
    }
  }
}
