//* Mutation publishes correctly, but the subscription isn't receiving it. */
//* The `PubSub` instance in the mutation is different from the subscription's `PubSub` instance. */
//* Using a module-level const pubSub = new PubSub() which creates separate instances per import. */
//* Implementing `PubSub` module-level will send mutation data over subscription. */

import { Injectable } from "@nestjs/common";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { Redis } from 'ioredis';

@Injectable()
export class PubSubService extends RedisPubSub {
    constructor() {
        // Todo: GraphQL connection - Update `pubsub.service.ts` to use existing Redis configuration

        const publisher = new Redis({ host: 'localhost', port: 6379 });
        const subscriber = new Redis({ host: 'localhost', port: 6379 });

        publisher.on('connect', () => console.log('✅ Redis publisher connected'));
        publisher.on('error', (err) => console.error('❌ Redis publisher error:', err));

        subscriber.on('connect', () => console.log('✅ Redis subscriber connected'));
        subscriber.on('error', (err) => console.error('❌ Redis subscriber error:', err));

        super({ 
            publisher, subscriber 
        });
    };
};
