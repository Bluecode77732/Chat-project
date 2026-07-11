import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AuditLogService } from 'src/audit-log/audit-log.service';
import { ModerationService, ModerationCallbacks } from './moderation.service';
import { ModerationStatus } from './enums/moderation-status.enum';
import { SYSTEM_USER_EMAIL } from './constants/moderation.constants';

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

  // cfg() reads via get(key, default) — return the default so thresholds are warn 3 / mute 5 / ban 7.
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
    // Seed consumes a one-time system-user lookup; every later lookup (applyBan) sees the target user.
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
  });

  describe('evaluateMessage escalation', () => {
    it('duplicate below flood threshold → no strike', async () => {
      mockRedis.eval.mockResolvedValueOnce(2); // dup count < 3
      await service.evaluateMessage(42, 'hi', callbacks());
      // only the dup counter eval ran; no strike eval
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    });

    it('flood → strike reaching warn threshold posts a warning message', async () => {
      mockRedis.eval
        .mockResolvedValueOnce(3) // dup >= 3 → flood
        .mockResolvedValueOnce(3); // strike == warnThreshold
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

  describe('recordVelocityViolation', () => {
    it('accrues a strike once per burst window', async () => {
      mockRedis.set.mockResolvedValueOnce('OK'); // NX marker acquired
      mockRedis.eval.mockResolvedValueOnce(1); // strike count
      await service.recordVelocityViolation(42);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'moderation:strike:42',
        expect.any(String),
      );
    });

    it('skips when the burst window is already marked', async () => {
      mockRedis.set.mockResolvedValueOnce(null); // NX marker not acquired
      await service.recordVelocityViolation(42);
      expect(mockRedis.eval).not.toHaveBeenCalled();
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
      mockRedis.set.mockResolvedValueOnce('OK'); // velMark acquired
      mockRedis.eval.mockResolvedValueOnce(5); // strike == mute threshold
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
      mockRedis.eval.mockResolvedValueOnce(3); // strike == warn threshold, no ctx
      await service.recordVelocityViolation(42);
      expect(mockChatRepository.save).not.toHaveBeenCalled();
    });

    it('skips the ban when the target user no longer exists', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.eval.mockResolvedValueOnce(7);
      mockUserRepository.findOne.mockResolvedValueOnce(null); // applyBan lookup misses
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
      expect(mockUserRepository.update).toHaveBeenCalled(); // ban still applied
    });

    it('a failing publish during a warning is swallowed', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(3); // warn
      const ctx = {
        ...callbacks(),
        publishFn: jest.fn().mockRejectedValue(new Error('pubsub down')),
      };
      await expect(
        service.evaluateMessage(42, 'spam', ctx),
      ).resolves.toBeUndefined();
    });

    it('a warning is skipped when the room no longer exists', async () => {
      mockRedis.eval.mockResolvedValueOnce(3).mockResolvedValueOnce(3); // warn
      mockRoomRepository.findOne.mockResolvedValueOnce(null);
      await service.evaluateMessage(42, 'spam', callbacks());
      expect(mockChatRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('seedSystemUser create path', () => {
    it('creates the system account when it does not exist yet', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null); // seed lookup misses
      await service.onModuleInit();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: SYSTEM_USER_EMAIL }),
      );
    });
  });
});
