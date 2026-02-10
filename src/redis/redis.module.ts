import { Global, Module } from "@nestjs/common";
import { createClient } from "redis";

@Global()
@Module({
    providers: [
        // Implementing Redis, in chat.module to limit and scoped its connection in chat module only, for sending messages rate-limit and keep user's data
        {
            // Client registers as 'REDIS_CLIENT' provider in NestJS dependency injection
            provide: 'REDIS_CLIENT',
            useFactory: async () => {
                try {
                    // Creates client instance to connect Redis server
                    const client = createClient({ url: 'redis://localhost:6379' });
                    client.on('error', (err) => console.error('Redis Error:', err));
                    
                    // Connect to Redis server
                    await client.connect();
                    console.log('Redis connected successfully');
                    
                    // Returns connection
                    return client;
                    
                } catch (error) {
                    console.error('Redis connection failed:', error);
                    throw error;
                }
            }
            // useFactory: async () => {
            //     const client = createClient({ url: 'redis://localhost:6379' }) // default Redis port:6379
            //     await client.connect();
            //     return client;
            // },
        },
    ],
    exports: ['REDIS_CLIENT'],
})
export class RedisModule { }
