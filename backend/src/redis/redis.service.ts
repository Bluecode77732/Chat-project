import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { UserEntity } from 'src/user/entities/user.entity';

export interface CachableMessage {
  id?: number;
  message?: string;
  created?: Date | string;
  participant?: Partial<UserEntity> | Record<string, unknown>;
}

interface CachedMessageEntry {
  id: number;
  message: string;
  created: Date;
  participant: Record<string, unknown>;
}

/**
 ** This Redis service replaces the in-memory(temporal store) `clientConnection` Map
 ** with Redis storage so user data persists across server restarts so it can prevent losing of data.
 ** The data is persistent between multiple servers for horizontal scaling in expansion of server.
 */

@Injectable()
export class SessionCacheService implements OnModuleInit {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.redis.del('online_users');
  }

  async sethUserOnline(userId: number, socketId: string) {
    const key = `user:${userId}`;
    const ttl = this.configService.get<number>('SESSION_TTL_SEC', 86400);
    // MULTI/EXEC: hset, expire, sadd execute atomically — prevents a TTL-less key if the server crashes between commands
    await this.redis
      .multi()
      .hset(key, 'socketId', socketId, 'status', 'online')
      .expire(key, ttl)
      .sadd('online_users', String(userId))
      .exec();
  }

  async sethUserOffline(userId: number) {
    await this.redis.hset(`user:${userId}`, 'status', 'offline');
    await this.redis.srem('online_users', String(userId));
  }

  async getUserStatus(
    userId: number,
  ): Promise<{ socketId?: string; status?: string } | null> {
    try {
      const data = await this.redis.hgetall(`user:${userId}`);
      return data?.socketId ? data : null;
    } catch {
      return null;
    }
  }

  async getOnlineUser(): Promise<number[] | null> {
    const members = await this.redis.smembers('online_users');
    return members.map(Number);
  }

  async cacheMessage(roomId: number, message: CachableMessage): Promise<void> {
    const { password: _, ...participant } = message.participant ?? {};
    const entry = JSON.stringify({
      id: message.id,
      message: message.message,
      created: message.created,
      participant,
    });
    const key = `room_messages:${roomId}`;
    await this.redis.lpush(key, entry);
    await this.redis.ltrim(key, 0, 14);
    await this.redis.expire(
      key,
      this.configService.get<number>('MESSAGE_CACHE_TTL_SEC', 86400),
    );
  }

  async deleteMessageCache(roomId: number): Promise<void> {
    await this.redis.del(`room_messages:${roomId}`);
  }

  async getCachedMessages(
    roomId: number,
  ): Promise<CachedMessageEntry[] | null> {
    const entries = await this.redis.lrange(`room_messages:${roomId}`, 0, 14);
    if (!entries.length) return null;
    // lpush stores newest at index 0; reverse to return oldest-first (matches DB order)
    return entries
      .flatMap((e) => {
        try {
          const m = JSON.parse(e) as CachedMessageEntry;
          return [{ ...m, created: new Date(m.created) }];
        } catch {
          return [];
        }
      })
      .reverse();
  }
}
