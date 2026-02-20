import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import * as RedisClient from "redis";
import { logger } from "src/base/logger/logger";

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: RedisClient.RedisClientType
    ) { }

    // The `canActivate` performs asynchronous Redis operations such as `incr` or `expire` that return Promises and need to be awaited.
    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            console.log('RateLimitGuard executing');

            const client = context.switchToWs().getClient();
            console.log('Client data:', client.data);

            const userId = client.data.user.sub;
            console.log('User ID:', userId);

            if (!userId) {
                throw new WsException("Cannot Find User Id");
            };

            const key = `rate limiting message: ${userId}`;
            const count = await this.redis.incr(key);
            console.log('RateLimitGuard passed', { userId, count });

            if (count === 1) {
                // Expires key in 60 seconds
                await this.redis.expire(key, 60);
                console.log('Redis key expired');
            };
            if (count > 10) {
                // Error when exceeds 10 messages in a per minute.
                throw new WsException("Rate limit exceeded");
            };

            // Returns rate-limit guard
            logger.info(`User's left message count: '${10 - count}'`);
            return true;

        } catch (error) {
            console.log(`Rate-Limit Guard error:`, error);
            logger.error(error.message, { timestamp: new Date().toISOString() })
            return false;
        };
    };
}
