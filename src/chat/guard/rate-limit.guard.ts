import {
  CanActivate,
  ExecutionContext,
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
    try {
      let userId: number;

      if (context.getType() === 'ws') {
        const client = context.switchToWs().getClient();
        userId = client.data.user.sub;
      } else {
        const gqlCtx = GqlExecutionContext.create(context).getContext();
        userId = gqlCtx.req?.user?.id;
      }

      if (!userId) {
        throw new WsException('Cannot Find User Id');
      }

      const contextType = context.getType() === 'ws' ? 'ws' : 'gql';
      const key = `rate_limit:${contextType}:${userId}`;
      // Lua script ensures INCR and EXPIRE execute atomically —
      // prevents a permanent key if the server crashes between the two commands
      const luaScript = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('EXPIRE', KEYS[1], 60)
        end
        return count
      `;
      const count = await this.redis.eval(luaScript, { keys: [key] }) as number;

      if (count > 10) {
        throw new WsException('Rate limit exceeded');
      }

      // Returns rate-limit guard
      logger.info(`${userId} left message count: '${10 - count}'`);
      return true;
    } catch (error: any) {
      logger.error(error.message, { timestamp: new Date().toISOString() });
      return false;
    }
  }
}
