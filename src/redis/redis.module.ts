import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import { SessionCacheService } from "./redis.service";

@Global()
@Module({
    providers: [
        SessionCacheService,
        // Implementing Redis module, in chat.module to limit and scoped its connection in chat module only, for sending messages rate-limit and keep user's data
        {
            // Client registers as 'REDIS_CLIENT' provider in NestJS dependency injection
            provide: 'REDIS_CLIENT',
            useFactory: async (configService: ConfigService) => {
                try {
                    // Creates client instance to connect Redis server
                    const client = createClient({ url: configService.get<string>('REDIS_URL') });
                    client.on('error', (err) => console.error('Redis Error:', err));

                    // Connect to Redis server
                    await client.connect();

                    // Returns connection
                    return client;

                } catch (error) {
                    throw error;
                };
            },
            inject: [ConfigService],
        },
    ],
    exports: ['REDIS_CLIENT', SessionCacheService],
})
export class RedisModule { }
