// Purpose: owns behavioral abuse detection (duplicate/flood + velocity strikes), strike accrual,
//   escalation (warn -> mute -> timed ban -> permanent ban), enforcement, the system-account seed,
//   and system-message dispatch. All stateful, side-effecting moderation logic lives here.
// Usage: called by ChatResolver (evaluateMessage, getSystemUserId), RateLimitGuard
//   (recordVelocityViolation), ModerationGuard (isBanned/isMuted), and UserController (unban).
// Rationale: enforcement carries side effects (DB writes, audit, cache invalidation, socket eviction),
//   so it belongs in a service, not the thin ModerationGuard — chat coupling is avoided via injected callbacks.

import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { UserRole } from 'src/auth/role/role';
import { AuditLogService } from 'src/audit-log/audit-log.service';
import { logger } from 'src/base/logger/logger';
import { ModerationStatus } from './enums/moderation-status.enum';
import { isEffectivelyBanned } from './moderation.util';
import {
  MODERATION_DEFAULTS,
  MODERATION_NOTICE,
  SYSTEM_USER_EMAIL,
  VELOCITY_MARK_TTL_SEC,
  moderationKeys,
} from './constants/moderation.constants';

// Chat-side effects the service needs at enforcement time, injected by the caller (ChatResolver)
// so ModerationModule never depends on ChatModule — mirrors AiService.handleReply(publishFn).
export type ModerationCallbacks = {
  roomId: number;
  publishFn: (msg: ChatEntity) => Promise<void>;
  disconnectFn: (userId: number) => Promise<void>;
};

@Injectable()
export class ModerationService implements OnModuleInit {
  private systemUser!: UserEntity;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(ChatEntity)
    private readonly chatRepository: Repository<ChatEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,

    private readonly configService: ConfigService,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,

    private readonly auditLogService: AuditLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedSystemUser();
  }

  getSystemUserId(): number {
    if (!this.systemUser?.id) {
      throw new BadRequestException('System user not initialized.');
    }
    return this.systemUser.id;
  }

  // ---- Gate helpers (read by ModerationGuard) ----

  // Effective ban = banned status AND (permanent OR the timed window has not elapsed).
  isBanned(user: Pick<UserEntity, 'status' | 'bannedUntil'>): boolean {
    return isEffectivelyBanned(user);
  }

  // DB-backed ban check for callers that only hold a userId (e.g. the socket handleConnection gate).
  async isUserBanned(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { status: true, bannedUntil: true },
    });
    return user ? isEffectivelyBanned(user) : false;
  }

  // Mute state is Redis-only (no DB fallback) — a Redis error fails closed (treated
  // as muted) rather than propagating uncaught through ModerationGuard as a 500.
  async isMuted(userId: number): Promise<boolean> {
    try {
      return (await this.redis.exists(moderationKeys.mute(userId))) === 1;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error(
        `[user=${userId}] Redis unavailable during mute check, failing closed: ${errMessage}`,
      );
      return true;
    }
  }

  // ---- Detection entry points ----

  // Called post-commit by ChatResolver with the sent message. A duplicate/flood accrues a strike;
  // escalation may then warn/mute/ban with the injected chat callbacks.
  async evaluateMessage(
    userId: number,
    message: string,
    ctx: ModerationCallbacks,
  ): Promise<void> {
    try {
      if (await this.isFlood(userId, message)) {
        logger.debug(`[user=${userId}] Flood detected, accruing strike`);
        await this.accrueStrike(userId, ctx);
      }
    } catch (err) {
      this.logError(`evaluateMessage failed (user=${userId})`, err);
    }
  }

  // Called by RateLimitGuard when its velocity limit trips. No chat callbacks on this path:
  // strike + mute/ban state apply, but no room notice / immediate socket eviction (eviction
  // is handled by the jwt.strategy / handleConnection ban gate on the next request).
  async recordVelocityViolation(userId: number): Promise<void> {
    try {
      const marked = await this.redis.set(
        moderationKeys.velMark(userId),
        '1',
        'EX',
        VELOCITY_MARK_TTL_SEC,
        'NX',
      );
      if (!marked) return; // this burst window already counted
      logger.debug(
        `[user=${userId}] Velocity violation marked, accruing strike`,
      );
      await this.accrueStrike(userId);
    } catch (err) {
      this.logError(`recordVelocityViolation failed (user=${userId})`, err);
    }
  }

  // ---- Admin recovery ----

  // Manual ban, independent of the automatic strike system (e.g. a report from another channel).
  // Unlike applyBan, this always audits — an admin action needs a trail even if the target was
  // already banned, since the reason/duration may differ from the prior entry.
  async ban(
    actorId: number,
    userId: number,
    reason?: string,
    durationSec?: number,
  ): Promise<void> {
    const bannedUntil = durationSec
      ? new Date(Date.now() + durationSec * 1000)
      : null;
    await this.userRepository.update(
      { id: userId },
      { status: ModerationStatus.banned, bannedUntil },
    );
    await this.redis.del(`user_cache:${userId}`);
    const detail = [reason, durationSec ? `${durationSec}s` : 'permanent']
      .filter(Boolean)
      .join(' | ');
    await this.auditLogService.log(actorId, userId, 'USER_BANNED', detail);
    logger.warn(
      `[actor=${actorId}, user=${userId}] Manually banned${durationSec ? ` for ${durationSec}s` : ' permanently'}`,
    );
  }

  // Reverse all moderation state for a false-positive: clears ban, strikes, mute, and the auth cache.
  async unban(actorId: number, userId: number): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { status: ModerationStatus.active, bannedUntil: null },
    );
    await Promise.all([
      this.redis.del(moderationKeys.strike(userId)),
      this.redis.del(moderationKeys.mute(userId)),
      this.redis.del(moderationKeys.velMark(userId)),
      this.redis.del(`user_cache:${userId}`),
    ]);
    await this.auditLogService.log(actorId, userId, 'USER_UNBAN');
    logger.info(`[actor=${actorId}, user=${userId}] Unban applied`);
  }

  // ---- Internal: detection ----

  private async isFlood(userId: number, message: string): Promise<boolean> {
    const normalized = message.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!normalized) return false;
    const hash = createHash('sha1').update(normalized).digest('hex');
    const cfg = this.cfg();
    const count = await this.incrWithTtl(
      moderationKeys.dup(userId, hash),
      cfg.dupWindowSec,
    );
    return count >= cfg.dupThreshold;
  }

  private async accrueStrike(
    userId: number,
    ctx?: ModerationCallbacks,
  ): Promise<void> {
    const cfg = this.cfg();
    const count = await this.incrWithTtl(
      moderationKeys.strike(userId),
      cfg.strikeWindowSec,
    );
    logger.debug(`[user=${userId}] Strike accrued: count=${count}`);
    await this.escalate(userId, count, ctx);
  }

  private async escalate(
    userId: number,
    count: number,
    ctx?: ModerationCallbacks,
  ): Promise<void> {
    const cfg = this.cfg();
    if (count >= cfg.banThreshold) {
      await this.applyBan(userId, ctx);
      return;
    }
    if (count === cfg.muteThreshold) {
      await this.applyMute(userId);
      if (ctx) await this.notify(ctx, MODERATION_NOTICE.mute);
      return;
    }
    if (count === cfg.warnThreshold && ctx) {
      logger.warn(
        `[user=${userId}] Moderation warning issued (strike ${count}/${cfg.warnThreshold})`,
      );
      await this.notify(ctx, MODERATION_NOTICE.warn);
    }
  }

  // ---- Internal: enforcement ----

  private async applyMute(userId: number): Promise<void> {
    const cfg = this.cfg();
    await this.redis.set(
      moderationKeys.mute(userId),
      '1',
      'EX',
      cfg.muteDurationSec,
    );
    await this.auditLogService.log(
      this.getSystemUserId(),
      userId,
      'USER_MUTED',
      `${cfg.muteDurationSec}s`,
    );
    logger.warn(`[user=${userId}] Muted for ${cfg.muteDurationSec}s`);
  }

  private async applyBan(
    userId: number,
    ctx?: ModerationCallbacks,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return;
    // Already effectively banned — don't re-audit or downgrade a permanent ban to timed.
    if (this.isBanned(user)) return;

    const cfg = this.cfg();
    const priorBans = await this.auditLogService.countByTarget(
      userId,
      'USER_BANNED',
    );
    const permanent = priorBans >= 1; // repeat offender -> permanent
    const bannedUntil = permanent
      ? null
      : new Date(Date.now() + cfg.banDurationSec * 1000);

    await this.userRepository.update(
      { id: userId },
      { status: ModerationStatus.banned, bannedUntil },
    );
    // Invalidate the auth cache so jwt.strategy re-reads the banned status next request.
    await this.redis.del(`user_cache:${userId}`);
    await this.auditLogService.log(
      this.getSystemUserId(),
      userId,
      'USER_BANNED',
      permanent ? 'permanent' : `until ${bannedUntil?.toISOString() ?? ''}`,
    );
    logger.warn(
      `[user=${userId}] ${permanent ? 'Permanently banned' : `Banned until ${bannedUntil?.toISOString() ?? ''}`}`,
    );

    if (ctx) {
      await this.notify(
        ctx,
        permanent ? MODERATION_NOTICE.banPermanent : MODERATION_NOTICE.banTimed,
      );
      try {
        await ctx.disconnectFn(userId);
      } catch (err) {
        this.logError(`disconnect failed (user=${userId})`, err);
      }
    }
  }

  // ---- Internal: system message + seed ----

  private async notify(ctx: ModerationCallbacks, text: string): Promise<void> {
    try {
      await this.sendSystemMessage(ctx.roomId, text, ctx.publishFn);
    } catch (err) {
      this.logError(`system message failed (room=${ctx.roomId})`, err);
    }
  }

  private async sendSystemMessage(
    roomId: number,
    text: string,
    publishFn: (msg: ChatEntity) => Promise<void>,
  ): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) return;
    const saved = await this.chatRepository.save(
      this.chatRepository.create({
        message: text,
        participant: this.systemUser,
        room,
      }),
    );
    const withRelations = Object.assign(saved, {
      participant: this.systemUser,
      room,
    });
    await publishFn(withRelations);
  }

  private async seedSystemUser(): Promise<void> {
    let systemUser = await this.userRepository.findOne({
      where: { email: SYSTEM_USER_EMAIL },
    });
    if (!systemUser) {
      const hashedPassword = await bcrypt.hash(
        'NO_LOGIN_SYSTEM_ACCOUNT',
        this.configService.getOrThrow<number>('HASH_ROUNDS'),
      );
      try {
        await this.userRepository.save({
          email: SYSTEM_USER_EMAIL,
          password: hashedPassword,
          role: UserRole.user,
        });
      } catch {
        // Race on multi-instance startup — another instance created it first.
      }
      systemUser = await this.userRepository.findOneByOrFail({
        email: SYSTEM_USER_EMAIL,
      });
    }
    this.systemUser = systemUser;
    logger.info(`Moderation system user ready: id=${this.systemUser.id}`);
  }

  // ---- Internal: helpers ----

  private cfg() {
    const c = this.configService;
    return {
      strikeWindowSec: c.get<number>(
        'MODERATION_STRIKE_WINDOW_SEC',
        MODERATION_DEFAULTS.strikeWindowSec,
      ),
      warnThreshold: c.get<number>(
        'MODERATION_WARN_THRESHOLD',
        MODERATION_DEFAULTS.warnThreshold,
      ),
      muteThreshold: c.get<number>(
        'MODERATION_MUTE_THRESHOLD',
        MODERATION_DEFAULTS.muteThreshold,
      ),
      muteDurationSec: c.get<number>(
        'MODERATION_MUTE_DURATION_SEC',
        MODERATION_DEFAULTS.muteDurationSec,
      ),
      banThreshold: c.get<number>(
        'MODERATION_BAN_THRESHOLD',
        MODERATION_DEFAULTS.banThreshold,
      ),
      banDurationSec: c.get<number>(
        'MODERATION_BAN_DURATION_SEC',
        MODERATION_DEFAULTS.banDurationSec,
      ),
      dupWindowSec: c.get<number>(
        'MODERATION_DUP_WINDOW_SEC',
        MODERATION_DEFAULTS.dupWindowSec,
      ),
      dupThreshold: c.get<number>(
        'MODERATION_DUP_THRESHOLD',
        MODERATION_DEFAULTS.dupThreshold,
      ),
    };
  }

  // Atomic INCR + first-write EXPIRE, matching RateLimitGuard — avoids a permanent key if the
  // process dies between the two commands.
  private async incrWithTtl(key: string, ttlSec: number): Promise<number> {
    const luaScript = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `;
    return (await this.redis.eval(luaScript, 1, key, String(ttlSec))) as number;
  }

  private logError(context: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[moderation] ${context}: ${msg}`);
  }
}
