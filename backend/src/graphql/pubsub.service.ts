// 모든 resolver가 하나의 인스턴스를 공유하도록 injectable singleton으로 구현 — 모듈 레벨에서
// `new PubSub()`를 쓰면 서로 다른 import 그래프마다 중복 생성되어, mutation과 subscription이
// 각각 다른 인스턴스로 갈라지고 결국 subscriber가 publish를 못 받는 문제가 생김.

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { Redis } from 'ioredis';
import { SessionCacheService } from 'src/redis/redis.service';
import { logger } from 'src/base/logger/logger';
import type { CachableMessage } from 'src/redis/interface/cachable-message.interface';

function isReceiveMessagePayload(
  value: unknown,
): value is { receiveMessage: CachableMessage } {
  return (
    typeof value === 'object' && value !== null && 'receiveMessage' in value
  );
}

@Injectable()
export class PubSubService extends RedisPubSub implements OnModuleDestroy {
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

    publisher.on('connect', () => logger.info('Redis publisher connected'));
    publisher.on('error', (err: Error) =>
      logger.error(`Redis publisher error: ${err.message}`),
    );

    subscriber.on('connect', () => logger.info('Redis subscriber connected'));
    subscriber.on('error', (err: Error) =>
      logger.error(`Redis subscriber error: ${err.message}`),
    );

    super({ publisher, subscriber });
  }

  // RedisPubSub.close()는 publisher와 subscriber ioredis 클라이언트를 모두 종료시킴.
  async onModuleDestroy() {
    try {
      await this.close();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error(`PubSub shutdown error: ${errMessage}`);
      throw err;
    }
  }

  async publish(triggerName: string, payload: unknown): Promise<void> {
    await super.publish(triggerName, payload);

    const match = triggerName.match(/receiveMessage :(\d+)/);
    if (match && isReceiveMessagePayload(payload)) {
      const roomId = parseInt(match[1]);
      try {
        await this.sessionCacheService.cacheMessage(
          roomId,
          payload.receiveMessage,
        );
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        logger.warn(`cacheMessage failed for room ${roomId}: ${errMessage}`);
      }
    }
  }
}
