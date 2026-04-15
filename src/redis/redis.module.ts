import { Global, Module } from "@nestjs/common";
import { createClient } from "redis";
import { SessionCacheService } from "./redis.service";
import { logger } from "src/base/logger/logger";

@Global()
@Module({
    providers: [
        SessionCacheService,
        // Implementing Redis module, in chat.module to limit and scoped its connection in chat module only, for sending messages rate-limit and keep user's data
        {
            // Client registers as 'REDIS_CLIENT' provider in NestJS dependency injection
            provide: 'REDIS_CLIENT',
            useFactory: async () => {
                try {
                    // Creates client instance to connect Redis server
                    const client = createClient({ url: process.env.REDIS_URL });
                    client.on('error', (err) => console.error('Redis Error:', err));
                    logger.error(`Redis Connection Fail`, { timestamp: new Date().toISOString() });
                    
                    // Connect to Redis server
                    await client.connect();
                    
                    // Returns connection
                    return client;
                    
                } catch (error) {
                    throw error;
                };
            },
        },
    ],
    exports: ['REDIS_CLIENT', SessionCacheService],
})
export class RedisModule { }
