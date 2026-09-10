// 목적: 행동 기반 어뷰징 탐지(중복/도배 + velocity 스트라이크), 스트라이크 누적,
//   에스컬레이션(경고 -> 음소거 -> 기간 밴 -> 영구 밴), 제재 집행, 시스템 계정 시딩,
//   시스템 메시지 발송을 담당. 상태를 갖는 부수효과성 모더레이션 로직은 전부 여기에 있음.
// 사용처: ChatResolver(evaluateMessage, getSystemUserId), RateLimitGuard
//   (recordVelocityViolation), ModerationGuard(isBanned/isMuted), UserController(unban)에서 호출.
// 근거: 제재 집행은 부수효과(DB 쓰기, 감사 로그, 캐시 무효화, 소켓 강제 종료)를 동반하므로
//   얇은 ModerationGuard가 아니라 서비스에 있어야 함 — chat과의 결합은 주입된 콜백으로 회피.

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

// 제재 집행 시점에 서비스가 필요로 하는 chat 측 부수효과 — 호출자(ChatResolver)가 주입해줌으로써
// ModerationModule이 ChatModule에 의존하지 않게 함 — AiService.handleReply(publishFn)과 동일한 패턴.
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

  // ---- 게이트 헬퍼 (ModerationGuard가 사용) ----

  // 실질적 밴 = banned 상태 AND (영구 OR 기간 밴 창이 아직 안 지남).
  isBanned(user: Pick<UserEntity, 'status' | 'bannedUntil'>): boolean {
    return isEffectivelyBanned(user);
  }

  // userId만 가진 호출자를 위한 DB 기반 밴 체크(예: 소켓 handleConnection 게이트).
  async isUserBanned(userId: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { status: true, bannedUntil: true },
    });
    return user ? isEffectivelyBanned(user) : false;
  }

  // 음소거 상태는 Redis에만 있음(DB 폴백 없음) — Redis 에러 시 fail-closed
  // (음소거된 것으로 간주)하며, ModerationGuard를 통해 처리되지 않은 500으로 전파하지 않음.
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

  // ---- 탐지 엔트리 포인트 ----

  // 커밋 이후 ChatResolver가 전송된 메시지와 함께 호출. 중복/도배면 스트라이크 누적;
  // 이후 에스컬레이션이 주입된 chat 콜백으로 경고/음소거/밴을 수행할 수 있음.
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

  // RateLimitGuard의 velocity 제한이 걸렸을 때 호출됨. 이 경로에는 chat 콜백이 없음:
  // 스트라이크 + 음소거/밴 상태는 적용되지만, 방 알림 / 즉시 소켓 강제 종료는 없음(강제 종료는
  // 다음 요청에서 jwt.strategy / handleConnection의 밴 게이트가 처리).
  async recordVelocityViolation(userId: number): Promise<void> {
    try {
      const marked = await this.redis.set(
        moderationKeys.velMark(userId),
        '1',
        'EX',
        VELOCITY_MARK_TTL_SEC,
        'NX',
      );
      if (!marked) return; // 이 버스트 윈도우는 이미 카운트됨
      logger.debug(
        `[user=${userId}] Velocity violation marked, accruing strike`,
      );
      await this.accrueStrike(userId);
    } catch (err) {
      this.logError(`recordVelocityViolation failed (user=${userId})`, err);
    }
  }

  // ---- 관리자 복구 ----

  // 자동 스트라이크 시스템과 무관한 수동 밴(예: 다른 채널로 들어온 신고). applyBan과 달리
  // 이건 항상 감사 로그를 남김 — 대상이 이미 밴 상태여도 사유/기간이 이전 기록과 다를 수 있으므로
  // 관리자 행동에는 흔적이 필요.
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

  // 오탐(false-positive)에 대해 모더레이션 상태 전체를 되돌림: 밴, 스트라이크, 음소거, 인증 캐시를 초기화.
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

  // ---- 내부: 탐지 ----

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

  // ---- 내부: 제재 집행 ----

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
    // 이미 실질적으로 밴 상태 — 재감사하거나 영구 밴을 기간 밴으로 낮추지 않음.
    if (this.isBanned(user)) return;

    const cfg = this.cfg();
    const priorBans = await this.auditLogService.countByTarget(
      userId,
      'USER_BANNED',
    );
    const permanent = priorBans >= 1; // 재범 -> 영구
    const bannedUntil = permanent
      ? null
      : new Date(Date.now() + cfg.banDurationSec * 1000);

    await this.userRepository.update(
      { id: userId },
      { status: ModerationStatus.banned, bannedUntil },
    );
    // 인증 캐시 무효화 — jwt.strategy가 다음 요청에서 밴 상태를 다시 읽도록.
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

  // ---- 내부: 시스템 메시지 + 시딩 ----

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
        // 멀티 인스턴스 기동 시 레이스 — 다른 인스턴스가 먼저 생성함.
      }
      systemUser = await this.userRepository.findOneByOrFail({
        email: SYSTEM_USER_EMAIL,
      });
    }
    this.systemUser = systemUser;
    logger.info(`Moderation system user ready: id=${this.systemUser.id}`);
  }

  // ---- 내부: 헬퍼 ----

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

  // 원자적 INCR + 최초 쓰기 시 EXPIRE, RateLimitGuard와 동일한 패턴 — 두 명령 사이에 프로세스가
  // 죽어도 영구 키가 남지 않도록 함.
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
