import { Test, TestingModule } from '@nestjs/testing';
import { SessionCacheService } from './redis.service';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

describe('SessionCacheService', () => {
  let redisService: SessionCacheService;
  let mockRedisClient: Partial<Redis>;

  const mockConfigService = {
    get: jest
      .fn()
      .mockImplementation(
        (_key: string, defaultValue: unknown) => defaultValue,
      ),
  };

  beforeEach(async () => {
    mockRedisClient = {
      hset: jest.fn(),
      expire: jest.fn(),
      hgetall: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      del: jest.fn(),
      multi: jest.fn(),
      quit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCacheService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    redisService = module.get<SessionCacheService>(SessionCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should clear online_users Set on startup', async () => {
      jest.spyOn(mockRedisClient, 'del').mockResolvedValue(1);

      await redisService.onModuleInit();

      expect(mockRedisClient.del).toHaveBeenCalledWith('online_users');
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit the shared Redis connection', async () => {
      jest.spyOn(mockRedisClient, 'quit').mockResolvedValue('OK');

      await redisService.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should log and rethrow when quit fails', async () => {
      jest
        .spyOn(mockRedisClient, 'quit')
        .mockRejectedValue(new Error('connection already closed'));

      await expect(redisService.onModuleDestroy()).rejects.toThrow(
        'connection already closed',
      );
    });
  });

  describe('sethUserOnline', () => {
    it('should store user hash and add to online_users Set', async () => {
      const mockUserId = 1;
      const socketId = 'mVkMdDQwpyoiEsDqSocketId';

      const mockChain = {
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        sadd: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      jest.spyOn(mockRedisClient, 'multi').mockReturnValue(mockChain as any);

      await redisService.sethUserOnline(mockUserId, socketId);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockChain.hset).toHaveBeenCalledWith(
        'user:1',
        'socketId',
        socketId,
        'status',
        'online',
      );
      expect(mockChain.expire).toHaveBeenCalledWith('user:1', 86400);
      expect(mockChain.sadd).toHaveBeenCalledWith('online_users', '1');
      expect(mockChain.exec).toHaveBeenCalled();
    });
  });

  describe('sethUserOffline', () => {
    it('should update status field and remove from online_users Set', async () => {
      const mockUserId = 1;

      const mockChain = {
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        srem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      jest.spyOn(mockRedisClient, 'multi').mockReturnValue(mockChain as any);

      await redisService.sethUserOffline(mockUserId);

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockChain.hset).toHaveBeenCalledWith(
        'user:1',
        'status',
        'offline',
      );
      expect(mockChain.expire).toHaveBeenCalledWith('user:1', 86400);
      expect(mockChain.srem).toHaveBeenCalledWith('online_users', '1');
      expect(mockChain.exec).toHaveBeenCalled();
    });
  });

  describe('getUserStatus', () => {
    it('should return user data when socketId exists', async () => {
      const mockUserId = 1;
      const socketId = 'mVkMdDQwpyoiEsDqSocketId';

      jest
        .spyOn(mockRedisClient, 'hgetall')
        .mockResolvedValue({ socketId, status: 'online' });

      const result = await redisService.getUserStatus(mockUserId);

      expect(mockRedisClient.hgetall).toHaveBeenCalledWith('user:1');
      expect(result).toEqual({ socketId, status: 'online' });
    });

    it('should return null when socketId does not exist', async () => {
      jest
        .spyOn(mockRedisClient, 'hgetall')
        .mockResolvedValue({ status: 'offline' });

      const result = await redisService.getUserStatus(1);

      expect(result).toBeNull();
    });

    it('should return null when hGetAll throws an error', async () => {
      jest
        .spyOn(mockRedisClient, 'hgetall')
        .mockRejectedValue(new Error('Redis error'));

      const result = await redisService.getUserStatus(1);

      expect(result).toBeNull();
    });
  });

  describe('getOnlineUser', () => {
    it('should return online user ids from Set', async () => {
      jest.spyOn(mockRedisClient, 'smembers').mockResolvedValue(['1', '2']);

      const result = await redisService.getOnlineUser();

      expect(mockRedisClient.smembers).toHaveBeenCalledWith('online_users');
      expect(result).toEqual([1, 2]);
    });

    it('should return empty array when no online users', async () => {
      jest.spyOn(mockRedisClient, 'smembers').mockResolvedValue([]);

      const result = await redisService.getOnlineUser();

      expect(result).toEqual([]);
    });
  });

  describe('cacheMessage', () => {
    it('should push message to list, trim to 10, and set expiry', async () => {
      const roomId = 1;
      const message = {
        id: 100,
        message: 'hello',
        created: new Date('2026-05-27T00:00:00.000Z'),
        participant: {
          id: 1,
          email: 'user@test.com',
          role: 0,
          password: 'secret',
        },
      };

      jest.spyOn(mockRedisClient, 'lpush').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'ltrim').mockResolvedValue('OK');
      jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);

      await redisService.cacheMessage(roomId, message);

      const key = 'room_messages:1';
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        key,
        expect.any(String),
      );
      expect(mockRedisClient.ltrim).toHaveBeenCalledWith(key, 0, 14);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(key, 86400);

      const lpushCall = (mockRedisClient.lpush as jest.Mock).mock.calls[0] as [
        string,
        string,
      ];
      const stored = JSON.parse(lpushCall[1]) as {
        participant?: Record<string, unknown>;
      };
      expect(stored).not.toHaveProperty('password');
      expect(stored.participant).not.toHaveProperty('password');
    });
  });

  describe('deleteMessageCache', () => {
    it('should delete the room message cache key', async () => {
      jest.spyOn(mockRedisClient, 'del').mockResolvedValue(1);

      await redisService.deleteMessageCache(1);

      expect(mockRedisClient.del).toHaveBeenCalledWith('room_messages:1');
    });
  });

  describe('getCachedMessages', () => {
    it('should return null when cache is empty', async () => {
      jest.spyOn(mockRedisClient, 'lrange').mockResolvedValue([]);

      const result = await redisService.getCachedMessages(1);

      expect(result).toBeNull();
    });

    it('should return messages in ascending order with Date objects', async () => {
      const entries = [
        JSON.stringify({
          id: 2,
          message: 'world',
          created: '2026-05-27T00:00:01.000Z',
          participant: { id: 1 },
        }),
        JSON.stringify({
          id: 1,
          message: 'hello',
          created: '2026-05-27T00:00:00.000Z',
          participant: { id: 1 },
        }),
      ];
      jest.spyOn(mockRedisClient, 'lrange').mockResolvedValue(entries);

      const result = await redisService.getCachedMessages(1);

      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        'room_messages:1',
        0,
        14,
      );
      expect(result).toHaveLength(2);
      expect(result![0].id).toBe(1);
      expect(result![1].id).toBe(2);
      expect(result![0].created).toBeInstanceOf(Date);
    });

    it('produces an Invalid Date when a cached entry has no created field', async () => {
      const entries = [
        JSON.stringify({ id: 1, message: 'hello', participant: { id: 1 } }),
      ];
      jest.spyOn(mockRedisClient, 'lrange').mockResolvedValue(entries);

      const result = await redisService.getCachedMessages(1);

      expect(result![0].created).toBeInstanceOf(Date);
      expect(Number.isNaN(result![0].created.getTime())).toBe(true);
    });

    it('drops an entry that fails to JSON.parse and keeps the rest', async () => {
      const entries = [
        '{not valid json',
        JSON.stringify({
          id: 1,
          message: 'hello',
          created: '2026-05-27T00:00:00.000Z',
          participant: { id: 1 },
        }),
      ];
      jest.spyOn(mockRedisClient, 'lrange').mockResolvedValue(entries);

      const result = await redisService.getCachedMessages(1);

      expect(result).toHaveLength(1);
      expect(result![0].id).toBe(1);
    });
  });
});
