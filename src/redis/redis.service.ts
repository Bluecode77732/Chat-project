import { Inject, Injectable } from "@nestjs/common";
import * as redisClient from "redis";

/**  
 ** This Redis service replace the in-memory(temporal store) `clientConnection` Map 
 ** with Redis storage so user data persists across server restarts, 

 ** Replace for preventing losing of data when server restarts
 ** Can share persisted data between multiple servers for horizontal scaling.
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
            
            // if (!data || !data.socketId) {
            //     console.log(`🔥 Cache Error: ${userId}`);
            //     return null;
            // };

            console.log(`✅ Got user present status: ${userId}`);
            console.log(`✅ Data: ${JSON.stringify(data)}`);

            return data.socketId ? data : null;
            // return {
            //     socketId: data.socketId.toString(),
            //     // socketId: String(data.socketId),
            //     status: data.status.toString() || 'status is null',
            //     // status: String(data.status || 'status is null'),
            // };

        } catch (error) {
            console.log(`🔥 Cache Error: ${userId}`, error.message);
            return null;
        };
    };
}
