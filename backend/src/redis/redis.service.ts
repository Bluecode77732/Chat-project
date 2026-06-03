import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as redisClient from 'redis';

/**
 ** This Redis service replaces the in-memory(temporal store) `clientConnection` Map
 ** with Redis storage so user data persists across server restarts so it can prevent losing of data.
 ** The data is persistent between multiple servers for horizontal scaling in expansion of server.
 */

@Injectable()
export class SessionCacheService implements OnModuleInit {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: redisClient.RedisClientType,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.redis.del('online_users');
  }

  async sethUserOnline(userId: number, socketId: string) {
    await this.redis.hSet(`user:${userId}`, { socketId, status: 'online' });
    await this.redis.expire(
      `user:${userId}`,
      this.configService.get<number>('SESSION_TTL_SEC', 86400),
    );
    // Track online user IDs in a dedicated Set for O(1) membership lookup
    await this.redis.sAdd('online_users', String(userId));
  }

  async sethUserOffline(userId: number) {
    await this.redis.hSet(`user:${userId}`, 'status', 'offline');
    await this.redis.sRem('online_users', String(userId));
  }

  async getUserStatus(
    userId: number,
  ): Promise<{ socketId?: string; status?: string } | null> {
    try {
      const data = await this.redis.hGetAll(`user:${userId}`);
      return data.socketId ? data : null;
    } catch (error) {
      return null;
    }
  }

  async getOnlineUser(): Promise<number[] | null> {
    const members = await this.redis.sMembers('online_users');
    return members.map(Number);
  }

  async cacheMessage(roomId: number, message: any): Promise<void> {
    const { password: _pw, ...participant } = message.participant ?? {};
    const entry = JSON.stringify({
      id: message.id,
      message: message.message,
      created: message.created,
      participant,
    });
    const key = `room_messages:${roomId}`;
    await this.redis.lPush(key, entry);
    await this.redis.lTrim(key, 0, 14);
    await this.redis.expire(
      key,
      this.configService.get<number>('MESSAGE_CACHE_TTL_SEC', 86400),
    );
  }

  async getCachedMessages(roomId: number): Promise<any[] | null> {
    const entries = await this.redis.lRange(`room_messages:${roomId}`, 0, 14);
    if (!entries.length) return null;
    // lPush stores newest at index 0; reverse to return oldest-first (matches DB order)
    return entries
      .map((e) => {
        const m = JSON.parse(e);
        return { ...m, created: new Date(m.created) };
      })
      .reverse();
  }
}
