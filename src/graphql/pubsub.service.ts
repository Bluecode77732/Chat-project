//* Mutation publishes correctly, but the subscription isn't receiving it. */
//* The `PubSub` instance in the mutation is different from the subscription's `PubSub` instance. */
//* Using a module-level const pubSub = new PubSub() which creates separate instances per import. */
//* Implementing `PubSub` module-level will send mutation data over subscription. */

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// import { PubSub } from "graphql-subscriptions";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { Redis } from 'ioredis';
import { createClient } from "redis";

@Injectable()
export class PubSubService extends RedisPubSub {
    constructor(
        // private readonly configService: ConfigService
    ) {
        // Todo: GraphQL connection - Update `pubsub.service.ts` to use existing Redis configuration

        const publisher = new Redis({ host: 'localhost', port: 6379 });
        const subscriber = new Redis({ host: 'localhost', port: 6379 });

        publisher.on('connect', () => console.log('✅ Redis publisher connected'));
        publisher.on('error', (err) => console.error('❌ Redis publisher error:', err));

        subscriber.on('connect', () => console.log('✅ Redis subscriber connected'));
        subscriber.on('error', (err) => console.error('❌ Redis subscriber error:', err));

        super({ publisher, subscriber });
        console.log('✅ PubSubService initialized');

        // const publisher = createClient({ url: "redis://localhost:6379" });
        // const subscriber = createClient({ url: "redis://localhost:6379" });

        // publisher.connect();
        // subscriber.connect();

        // super({
        //     publisher: publisher as any,
        //     subscriber: subscriber as any,
        // });

        // const redisConfig = {
        //     host: configService.get("DB_HOST"),
        //     port: configService.get("DB_PORT"),
        // };

        // super({
        //     publisher: new Redis(redisConfig),
        //     subscriber: new Redis(redisConfig),
        // });
    };
};
