//* Mutation publishes correctly, but the subscription isn't receiving it. */
//* The `PubSub` instance in the mutation is different from the subscription's `PubSub` instance. */
//* Using a module-level const pubSub = new PubSub() which creates separate instances per import. */
//* Implementing `PubSub` module-level will send mutation data over subscription. */

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { Redis } from 'ioredis';

@Injectable()
export class PubSubService extends RedisPubSub {
    constructor(private configService: ConfigService) {
        const redisUrl = configService.get<string>('REDIS_URL');
        
        if (redisUrl === undefined || null) {
            throw new InternalServerErrorException();
        }
        
        const url = new URL(redisUrl);

        const redisConfig = {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password || undefined,
        };

        const publisher = new Redis(redisConfig);
        const subscriber = new Redis(redisConfig);

        publisher.on('connect', () => console.log('✅ Redis publisher connected'));
        publisher.on('error', (err) => console.error('❌ Redis publisher error:', err));

        subscriber.on('connect', () => console.log('✅ Redis subscriber connected'));
        subscriber.on('error', (err) => console.error('❌ Redis subscriber error:', err));

        super({ publisher, subscriber });
    };
};
