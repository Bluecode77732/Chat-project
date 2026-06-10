//* Mutation publishes correctly, but the subscription isn't receiving it. */
//* The `PubSub` instance in the mutation is different from the subscription's `PubSub` instance. */
//* Using a module-level const pubSub = new PubSub() which creates separate instances per import. */
//* Implementing `PubSub` module-level will send mutation data over subscription. */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';
import { SessionCacheService } from 'src/redis/redis.service';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class PubSubService extends RedisPubSub {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionCacheService: SessionCacheService,
  ) {
    const redisUrl = configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    const url = new URL(redisUrl);
    const isTls = url.protocol === 'rediss:';

    const redisConfig = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
      ...(isTls ? { tls: {} } : {}),
    };

    const publisher = new Redis(redisConfig);
    const subscriber = new Redis(redisConfig);

    publisher.on('connect', () => console.log('✅ Redis publisher connected'));
    publisher.on('error', (err) =>
      console.error('❌ Redis publisher error:', err),
    );

    subscriber.on('connect', () =>
      console.log('✅ Redis subscriber connected'),
    );
    subscriber.on('error', (err) =>
      console.error('❌ Redis subscriber error:', err),
    );

    super({ publisher, subscriber });
  }

  async publish(triggerName: string, payload: unknown): Promise<void> {
    await super.publish(triggerName, payload);

    const match = triggerName.match(/receiveMessage :(\d+)/);
    if (match) {
      const roomId = parseInt(match[1]);
      const message = (payload as { receiveMessage: unknown }).receiveMessage;
      try {
        await this.sessionCacheService.cacheMessage(roomId, message);
      } catch (err) {
        logger.warn(
          `cacheMessage failed for room ${roomId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
