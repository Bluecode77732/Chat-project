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

// Redis 기반 세션 캐시로, 기존 인메모리 `clientConnection` Map을 대체 — 재시작에도 살아남고
// 수평 확장된 인스턴스 간에 공유됨.

// `online_users`를 위한 백그라운드 안전망일 뿐, 주 정확성 경로는 아님(그건 여전히
// sethUserOnline/sethUserOffline의 sadd/srem 쌍). 5분이라는 값은 주 메커니즘과 경합하지 않으면서
// 최악의 경우 ghost 유저 노출 시간을 SESSION_TTL_SEC(기본 86400초)의 작은 일부로 제한함.
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
    // online_users를 무조건 지우는 대신 (이미 TTL을 가진) user:{id}와 대조해서 정리함 —
    // REDIS_CLIENT는 수평 확장된 인스턴스 간에 공유되므로, 여기서 무조건 DEL하면
    // 다른 인스턴스에 여전히 연결된 유저까지 지워버림.
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

  // REDIS_CLIENT는 여러 다른 서비스(ai/auth/user/rate-limit guard)가 공유하는
  // 전역 모듈 스코프 싱글턴 — 다들 같은 커넥션 참조를 들고 있으므로 종료 시
  // 여기서 한 번만 quit하면 충분함.
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

  // SSCAN(커서 기반, 여기서 SMEMBERS는 절대 안 씀 — 규모가 커졌을 때 한 번에
  // 블로킹 읽는 걸 피하는 게 핵심)으로 online_users를 순회하며, user:{id} 해시가
  // 더 이상 존재하지 않는 멤버(즉 sethUserOffline의 srem을 거치지 못하고 비정상
  // 종료된 프로세스가 남긴 stale/ghost 엔트리)를 제거.
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

  // SSCAN 한 페이지 기준: id마다 EXISTS user:{id} 체크를 파이프라인으로 묶고,
  // 존재하지 않는 것들만 모아 srem 한 번으로 처리.
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
    // MULTI/EXEC: hset, expire, sadd가 원자적으로 실행됨 — 커맨드 사이에 서버가 죽어도 TTL 없는 키가 남지 않도록 함
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
    // lpush는 최신 항목을 index 0에 저장 — DB 순서(오래된 순)에 맞추기 위해 reverse
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
