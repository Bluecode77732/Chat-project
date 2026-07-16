import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { logger } from 'src/base/logger/logger';
import type { CachableMessage } from './interface/cachable-message.interface';

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

// Background safety net for `online_users`, not the primary correctness path (that
// remains the sadd/srem pair in sethUserOnline/sethUserOffline). 5 minutes bounds the
// worst-case ghost-user visibility window to a small fraction of SESSION_TTL_SEC
// (default 86400s) without competing with the primary mechanism.
export const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
const RECONCILE_SCAN_BATCH_SIZE = 100;

@Injectable()
export class SessionCacheService implements OnModuleInit, OnModuleDestroy {
  private reconcileIntervalHandle: ReturnType<typeof setInterval> | undefined;

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Reconciles against user:{id} (which already carries a TTL) instead of blindly
    // wiping online_users — REDIS_CLIENT is shared across horizontally-scaled instances,
    // so an unconditional DEL here would erase other instances' still-connected users.
    await this.reconcileOnlineUsers();

    this.reconcileIntervalHandle = setInterval(() => {
      this.reconcileOnlineUsers().catch((err: unknown) => {
        const errMessage = err instanceof Error ? err.message : String(err);
        logger.error(
          `online_users reconciliation interval error: ${errMessage}`,
        );
      });
    }, RECONCILE_INTERVAL_MS);
  }

  // REDIS_CLIENT is a Global module-scoped singleton shared by several other
  // services (ai/auth/user/rate-limit guard) — quitting it once here on shutdown
  // is sufficient since they all hold a reference to the same connection.
  async onModuleDestroy() {
    if (this.reconcileIntervalHandle) {
      clearInterval(this.reconcileIntervalHandle);
      this.reconcileIntervalHandle = undefined;
    }

    try {
      await this.redis.quit();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error(`REDIS_CLIENT shutdown error: ${errMessage}`);
      throw err;
    }
  }

  // Sweeps online_users via SSCAN (cursor-based, never SMEMBERS here — avoiding an
  // all-at-once blocking read at scale is the point) and removes members whose
  // user:{id} hash no longer exists, i.e. stale/ghost entries left behind by an
  // ungraceful process crash that skipped sethUserOffline's srem.
  private async reconcileOnlineUsers(): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, members] = await this.redis.sscan(
          'online_users',
          cursor,
          'COUNT',
          RECONCILE_SCAN_BATCH_SIZE,
        );
        cursor = nextCursor;

        if (members.length > 0) {
          await this.removeStaleMembers(members);
        }
      } while (cursor !== '0');
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error(`online_users reconciliation sweep failed: ${errMessage}`);
    }
  }

  // For one SSCAN page: pipelines an EXISTS user:{id} check per id, then batches a
  // single srem for whichever don't exist.
  private async removeStaleMembers(userIds: string[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const id of userIds) {
      pipeline.exists(`user:${id}`);
    }
    const results = await pipeline.exec();

    if (!results) {
      logger.warn('online_users reconciliation: pipeline exec returned null');
      return;
    }

    const staleIds: string[] = [];
    results.forEach(([err, existsResult], index) => {
      const id = userIds[index];
      if (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        logger.warn(
          `online_users reconciliation: EXISTS check failed for user:${id}: ${errMessage}`,
        );
        return;
      }
      if (existsResult === 0) {
        staleIds.push(id);
      }
    });

    if (staleIds.length > 0) {
      await this.redis.srem('online_users', ...staleIds);
    }
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
    const key = `user:${userId}`;
    const ttl = this.configService.get<number>('SESSION_TTL_SEC', 86400);
    await this.redis
      .multi()
      .hset(key, 'status', 'offline')
      .expire(key, ttl)
      .srem('online_users', String(userId))
      .exec();
  }

  async getUserStatus(
    userId: number,
  ): Promise<{ socketId?: string; status?: string } | null> {
    try {
      const data = await this.redis.hgetall(`user:${userId}`);
      return data?.socketId ? data : null;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.warn(`[user=${userId}] getUserStatus Redis error: ${errMessage}`);
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
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : String(err);
          logger.warn(
            `[room=${roomId}] Cache entry parse failed: ${errMessage}`,
          );
          return [];
        }
      })
      .reverse();
  }
}
