import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AuditLogService } from 'src/audit-log/audit-log.service';
import { ModerationService, ModerationCallbacks } from './moderation.service';
import { ModerationStatus } from './enums/moderation-status.enum';
import {
  SYSTEM_USER_EMAIL,
  moderationKeys,
} from './constants/moderation.constants';

jest.mock('src/base/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('ModerationService', () => {
  let service: ModerationService;

  const systemUser: UserEntity = { id: 999, email: SYSTEM_USER_EMAIL };

  const mockUserRepository = {
    findOne: jest.fn().mockResolvedValue(systemUser),
    findOneByOrFail: jest.fn().mockResolvedValue(systemUser),
    save: jest.fn().mockResolvedValue(systemUser),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockChatRepository = {
    create: jest.fn((x: Partial<ChatEntity>) => x),
    save: jest.fn((x: Partial<ChatEntity>) => Promise.resolve({ id: 1, ...x })),
  };

  const mockRoomRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 10 }),
  };

  // cfg()는 get(key, default)로 읽으므로 default를 그대로 반환 — 임계값은 warn 3 / mute 5 / ban 7로 고정됨
  const mockConfigService = {
    get: jest.fn((_key: string, def: number) => def),
    getOrThrow: jest.fn().mockReturnValue(10),
  };

  const mockRedis = {
    eval: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
    countByTarget: jest.fn().mockResolvedValue(0),
  };

  const callbacks = (): ModerationCallbacks => ({
    roomId: 10,
    publishFn: jest.fn().mockResolvedValue(undefined),
    disconnectFn: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(ChatEntity),
          useValue: mockChatRepository,
        },
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: mockRoomRepository,
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
    // seed가 system-user 조회를 한 번 소비하므로, 이후 조회(applyBan)는 모두 target user를 보게 됨
    mockUserRepository.findOne
      .mockResolvedValueOnce(systemUser)
      .mockResolvedValue({
        id: 42,
        status: ModerationStatus.active,
        bannedUntil: null,
      });
    await service.onModuleInit();
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined and seed the system user', () => {
    expect(service).toBeDefined();
    expect(service.getSystemUserId()).toBe(999);
  });

  describe('isBanned', () => {
    it('active → false', () => {
      expect(
        service.isBanned({
          status: ModerationStatus.active,
          bannedUntil: null,
        }),
      ).toBe(false);
    });
    it('banned + no bannedUntil → true (permanent)', () => {
      expect(
        service.isBanned({
          status: ModerationStatus.banned,
          bannedUntil: null,
        }),
      ).toBe(true);
    });
    it('banned + future bannedUntil → true (timed, active)', () => {
      const future = new Date(Date.now() + 60_000);
      expect(
        service.isBanned({
          status: ModerationStatus.banned,
          bannedUntil: future,
        }),
      ).toBe(true);
    });
    it('banned + past bannedUntil → false (timed, elapsed)', () => {
      const past = new Date(Date.now() - 60_000);
      expect(
        service.isBanned({
          status: ModerationStatus.banned,
          bannedUntil: past,
        }),
      ).toBe(false);
    });
  });

  describe('isMuted', () => {
    it('returns true when the mute key exists', async () => {
      mockRedis.exists.mockResolvedValueOnce(1);
      await expect(service.isMuted(42)).resolves.toBe(true);
    });
    it('returns false when the mute key is absent', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      await expect(service.isMuted(42)).resolves.toBe(false);
    });
    it('fails closed (returns true) when redis is unavailable', async () => {
      mockRedis.exists.mockRejectedValueOnce(new Error('redis down'));
      await expect(service.isMuted(42)).resolves.toBe(true);
    });
  });

  describe('evaluateMessage escalation', () => {
    it('duplicate below flood threshold → no strike', async () => {
      mockRedis.eval.mockResolvedValueOnce(2); // dup count < 3
      await service.evaluateMessage(42, 'hi', callbacks());
      // dup 카운터 eval만 실행됨 — strike eval은 실행되지 않음
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    });

    it('flood → strike reaching warn threshold posts a warning message', async () => {
      mockRedis.eval
        .mockResolvedValueOnce(3) // dup >= 3 → flood
        .mockResolvedValueOnce(3); // strike == warnThreshold(경고 임계값)
      const ctx = callbacks();
      await service.evaluateMessage(42, 'spam', ctx);
      expect(ctx.publishFn).toHaveBeenCalledTimes(1);
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });

    it('strike reaching mute threshold sets the mute key and audits USER_MUTED', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(5);
      const ctx = callbacks();
      await service.evaluateMessage(42, 'spam', ctx);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'moderation:mute:42',
        '1',
        'EX',
        600,
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        999,
        42,
        'USER_MUTED',
        '600s',
      );
    });

    it('strike reaching ban threshold with no prior ban applies a timed ban and disconnects', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
      mockAuditLogService.countByTarget.mockResolvedValueOnce(0);
      const ctx = callbacks();
      await service.evaluateMessage(42, 'spam', ctx);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 42 },
        expect.objectContaining({
          status: ModerationStatus.banned,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          bannedUntil: expect.any(Date),
        }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith('user_cache:42');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        999,
        42,
        'USER_BANNED',
        expect.stringContaining('until'),
      );
      expect(ctx.disconnectFn).toHaveBeenCalledWith(42);
    });

    it('ban with a prior ban is permanent (bannedUntil null)', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
      mockAuditLogService.countByTarget.mockResolvedValueOnce(1);
      await service.evaluateMessage(42, 'spam', callbacks());
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 42 },
        { status: ModerationStatus.banned, bannedUntil: null },
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        999,
        42,
        'USER_BANNED',
        'permanent',
      );
    });

    it('does not re-ban an already-banned user', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
      mockUserRepository.findOne.mockResolvedValueOnce({
        id: 42,
        status: ModerationStatus.banned,
        bannedUntil: null,
      });
      await service.evaluateMessage(42, 'spam', callbacks());
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('escalation boundaries (exact-match invariants)', () => {
    // escalate()의 비교 연산자를 고정: warn/mute는 ===(정확히 그 카운트에서 한 번만 발동),
    // ban은 >=. ===를 >=로 바꾸면 이후 모든 strike에서 mute/warn이 재발동하게 되므로,
    // 아래 임계값 사이 구간 테스트들이 그 회귀를 잡아냄
    it('strike between warn and mute (4) fires nothing', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
      const ctx = callbacks();
      await service.evaluateMessage(42, 'spam', ctx);
      expect(ctx.publishFn).not.toHaveBeenCalled(); // warn/mute 알림 없음
      expect(mockRedis.set).not.toHaveBeenCalled(); // mute 키 설정 없음
      expect(mockUserRepository.update).not.toHaveBeenCalled(); // ban 없음
    });

    it('strike between mute and ban (6) does not re-fire mute or ban', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(6);
      const ctx = callbacks();
      await service.evaluateMessage(42, 'spam', ctx);
      // 임계값 비교가 ===가 아니라 >=였다면 여기서 mute가 재발동했을 것
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(ctx.publishFn).not.toHaveBeenCalled();
    });

    it('strike above the ban threshold (8) still bans (ban uses >=)', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(8);
      mockAuditLogService.countByTarget.mockResolvedValueOnce(0);
      await service.evaluateMessage(42, 'spam', callbacks());
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 42 },
        expect.objectContaining({ status: ModerationStatus.banned }),
      );
    });
  });

  describe('moderationKeys naming convention', () => {
    it('builds keys as {service}:{entity}:{id}', () => {
      expect(moderationKeys.strike(42)).toBe('moderation:strike:42');
      expect(moderationKeys.mute(42)).toBe('moderation:mute:42');
      expect(moderationKeys.velMark(42)).toBe('moderation:velmark:42');
      expect(moderationKeys.dup(42, 'abc')).toBe('moderation:dup:42:abc');
    });
  });

  describe('recordVelocityViolation', () => {
    it('accrues a strike once per burst window', async () => {
      mockRedis.set.mockResolvedValueOnce('OK'); // NX 마커 획득
      mockRedis.eval.mockResolvedValueOnce(1); // strike count(누적 횟수)
      await service.recordVelocityViolation(42);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'moderation:strike:42',
        expect.any(String),
      );
    });

    it('skips when the burst window is already marked', async () => {
      mockRedis.set.mockResolvedValueOnce(null); // NX 마커 획득 실패
      await service.recordVelocityViolation(42);
      expect(mockRedis.eval).not.toHaveBeenCalled();
    });
  });

  describe('ban', () => {
    it('permanent ban when no duration is given', async () => {
      await service.ban(7, 42, 'spam reports');
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 42 },
        { status: ModerationStatus.banned, bannedUntil: null },
      );
      expect(mockRedis.del).toHaveBeenCalledWith('user_cache:42');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        7,
        42,
        'USER_BANNED',
        'spam reports | permanent',
      );
    });

    it('timed ban sets a future bannedUntil and includes the duration in the audit detail', async () => {
      await service.ban(7, 42, undefined, 3600);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 42 },
        expect.objectContaining({
          status: ModerationStatus.banned,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          bannedUntil: expect.any(Date),
        }),
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        7,
        42,
        'USER_BANNED',
        '3600s',
      );
    });

    it('omits the reason segment from the audit detail when none is given', async () => {
      await service.ban(7, 42);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        7,
        42,
        'USER_BANNED',
        'permanent',
      );
    });
  });

  describe('unban', () => {
    it('clears ban state, redis keys, cache, and audits USER_UNBAN', async () => {
      await service.unban(7, 42);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 42 },
        { status: ModerationStatus.active, bannedUntil: null },
      );
      expect(mockRedis.del).toHaveBeenCalledWith('moderation:strike:42');
      expect(mockRedis.del).toHaveBeenCalledWith('moderation:mute:42');
      expect(mockRedis.del).toHaveBeenCalledWith('user_cache:42');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(7, 42, 'USER_UNBAN');
    });
  });

  describe('getSystemUserId', () => {
    it('throws when the system user is not initialized', () => {
      (
        service as unknown as { systemUser: UserEntity | undefined }
      ).systemUser = undefined;
      expect(() => service.getSystemUserId()).toThrow(
        'System user not initialized.',
      );
    });
  });

  describe('isUserBanned (DB-backed)', () => {
    it('true when the looked-up user is banned', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        status: ModerationStatus.banned,
        bannedUntil: null,
      });
      await expect(service.isUserBanned(42)).resolves.toBe(true);
    });
    it('false when the user is active', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({
        status: ModerationStatus.active,
        bannedUntil: null,
      });
      await expect(service.isUserBanned(42)).resolves.toBe(false);
    });
    it('false when the user is not found', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.isUserBanned(42)).resolves.toBe(false);
    });
  });

  describe('velocity-path escalation (no callbacks)', () => {
    it('applies a mute at the mute threshold with no room notice', async () => {
      mockRedis.set.mockResolvedValueOnce('OK'); // velMark 획득
      mockRedis.eval.mockResolvedValueOnce(5); // strike == mute threshold(뮤트 임계값)
      await service.recordVelocityViolation(42);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'moderation:mute:42',
        '1',
        'EX',
        600,
      );
      expect(mockChatRepository.save).not.toHaveBeenCalled();
    });

    it('applies a ban at the ban threshold with no notice or disconnect', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.eval.mockResolvedValueOnce(7);
      mockAuditLogService.countByTarget.mockResolvedValueOnce(0);
      await service.recordVelocityViolation(42);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 42 },
        expect.objectContaining({ status: ModerationStatus.banned }),
      );
      expect(mockChatRepository.save).not.toHaveBeenCalled();
    });

    it('does not warn on the velocity path even at the warn threshold', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.eval.mockResolvedValueOnce(3); // strike == warn threshold(경고 임계값), ctx 없음
      await service.recordVelocityViolation(42);
      expect(mockChatRepository.save).not.toHaveBeenCalled();
    });

    it('skips the ban when the target user no longer exists', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.eval.mockResolvedValueOnce(7);
      mockUserRepository.findOne.mockResolvedValueOnce(null); // applyBan 조회가 실패함
      await service.recordVelocityViolation(42);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('error paths are swallowed (never throw to the caller)', () => {
    it('evaluateMessage tolerates a redis failure', async () => {
      mockRedis.eval.mockRejectedValueOnce(new Error('redis down'));
      await expect(
        service.evaluateMessage(42, 'x', callbacks()),
      ).resolves.toBeUndefined();
    });

    it('recordVelocityViolation tolerates a redis failure', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('redis down'));
      await expect(
        service.recordVelocityViolation(42),
      ).resolves.toBeUndefined();
    });

    it('a failing disconnect callback during a ban is swallowed', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
      mockAuditLogService.countByTarget.mockResolvedValueOnce(0);
      const ctx = {
        ...callbacks(),
        disconnectFn: jest.fn().mockRejectedValue(new Error('socket gone')),
      };
      await expect(
        service.evaluateMessage(42, 'spam', ctx),
      ).resolves.toBeUndefined();
      expect(mockUserRepository.update).toHaveBeenCalled(); // ban은 그대로 적용됨
    });

    it('a failing publish during a warning is swallowed', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(3); // 경고
      const ctx = {
        ...callbacks(),
        publishFn: jest.fn().mockRejectedValue(new Error('pubsub down')),
      };
      await expect(
        service.evaluateMessage(42, 'spam', ctx),
      ).resolves.toBeUndefined();
    });

    it('a warning is skipped when the room no longer exists', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(3); // 경고
      mockRoomRepository.findOne.mockResolvedValueOnce(null);
      await service.evaluateMessage(42, 'spam', callbacks());
      expect(mockChatRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('seedSystemUser create path', () => {
    it('creates the system account when it does not exist yet', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null); // seed 조회가 실패함
      await service.onModuleInit();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: SYSTEM_USER_EMAIL }),
      );
    });
  });
});
