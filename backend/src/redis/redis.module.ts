import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { SessionCacheService } from './redis.service';
import { logger } from 'src/base/logger/logger';

@Global()
@Module({
  providers: [
    SessionCacheService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        const url = new URL(redisUrl!);
        const isTls = url.protocol === 'rediss:';

        const client = new Redis({
          host: url.hostname,
          port: parseInt(url.port || '6379'),
          password: url.password || undefined,
          ...(isTls ? { tls: {} } : {}),
        });

        client.on('error', (err: Error) =>
          logger.error(
            `Redis runtime error: ${err.message}\n${err.stack ?? ''}`,
          ),
        );

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT', SessionCacheService],
})
export class RedisModule {}
