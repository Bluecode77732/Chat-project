import { Inject, Injectable } from "@nestjs/common";
import * as redisClient from "redis";

/**  
 ** This Redis service replaces the in-memory(temporal store) `clientConnection` Map 
 ** with Redis storage so user data persists across server restarts so it can prevent losing of data.
 ** The data is persistent between multiple servers for horizontal scaling in expansion of server.
*/

@Injectable()
export class SessionCacheService {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: redisClient.RedisClientType,
    ) { };

    async sethUserOnline(userId: number, socketId: string) {
        // Stores user data as Redis hash; format: user:key
        // Setting `status` track presence
        // Hash allows storing multiple fields without creating separate keys
        await this.redis.hSet(`user:${userId}`, { socketId, status: 'online' });
        console.log(`✅ Cache SET:${userId}`, socketId);
        // Sets 24h of expiration on the user key to automatically clean up data properly after 24h.
        // Prevents Redis memory buildup from abandoned sessions
        await this.redis.expire(`user:${userId}`, 86400);
    };

    async sethUserOffline(userId: number) {
        // Updates `status` field only without deleting socketId
        // Keeps tracking `userId` and last seen information
        await this.redis.hSet(`user:${userId}`, 'status', 'offline');
        console.log(`✅ Cache SET:${userId}`);
    };

    async getUserStatus(userId: number): Promise<{ socketId?: string, status?: string } | null> {
        console.log(`✅ Got user present status: ${userId}`);

        try {
            const data = await this.redis.hGetAll(`user:${userId}`);

            console.log(`✅ Got user present status: ${userId}`);
            console.log(`✅ Data: ${JSON.stringify(data)}`);

            return data.socketId ? data : null;

        } catch (error) {
            console.log(`🔥 Cache Error: ${userId}`, error.message);
            return null;
        };
    };
}
