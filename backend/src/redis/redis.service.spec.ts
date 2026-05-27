import { Test, TestingModule } from '@nestjs/testing';
import { SessionCacheService } from './redis.service';
import { RedisClientType } from 'redis';

describe('SessionCacheService', () => {
  let redisService: SessionCacheService;
  let mockRedisClient: Partial<RedisClientType>;

  beforeEach(async () => {
    mockRedisClient = {
      hSet: jest.fn(),
      expire: jest.fn(),
      hGetAll: jest.fn(),
      sAdd: jest.fn(),
      sRem: jest.fn(),
      sMembers: jest.fn(),
      lPush: jest.fn(),
      lTrim: jest.fn(),
      lRange: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCacheService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
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

  describe('sethUserOnline', () => {
    it('should store user hash and add to online_users Set', async () => {
      const mockUserId = 1;
      const socketId = 'mVkMdDQwpyoiEsDqSocketId';

      jest.spyOn(mockRedisClient, 'hSet').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'sAdd').mockResolvedValue(1);

      await redisService.sethUserOnline(mockUserId, socketId);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user:1', {
        socketId,
        status: 'online',
      });
      expect(mockRedisClient.expire).toHaveBeenCalledWith('user:1', 86400);
      expect(mockRedisClient.sAdd).toHaveBeenCalledWith('online_users', '1');
    });
  });

  describe('sethUserOffline', () => {
    it('should update status field and remove from online_users Set', async () => {
      const mockUserId = 1;

      jest.spyOn(mockRedisClient, 'hSet').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'sRem').mockResolvedValue(1);

      await redisService.sethUserOffline(mockUserId);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith(
        'user:1',
        'status',
        'offline',
      );
      expect(mockRedisClient.sRem).toHaveBeenCalledWith('online_users', '1');
    });
  });

  describe('getUserStatus', () => {
    it('should return user data when socketId exists', async () => {
      const mockUserId = 1;
      const socketId = 'mVkMdDQwpyoiEsDqSocketId';

      jest
        .spyOn(mockRedisClient, 'hGetAll')
        .mockResolvedValue({ socketId, status: 'online' });

      const result = await redisService.getUserStatus(mockUserId);

      expect(mockRedisClient.hGetAll).toHaveBeenCalledWith('user:1');
      expect(result).toEqual({ socketId, status: 'online' });
    });

    it('should return null when socketId does not exist', async () => {
      jest
        .spyOn(mockRedisClient, 'hGetAll')
        .mockResolvedValue({ status: 'offline' });

      const result = await redisService.getUserStatus(1);

      expect(result).toBeNull();
    });

    it('should return null when hGetAll throws an error', async () => {
      jest
        .spyOn(mockRedisClient, 'hGetAll')
        .mockRejectedValue(new Error('Redis error'));

      const result = await redisService.getUserStatus(1);

      expect(result).toBeNull();
    });
  });

  describe('getOnlineUser', () => {
    it('should return online user ids from Set', async () => {
      jest.spyOn(mockRedisClient, 'sMembers').mockResolvedValue(['1', '2']);

      const result = await redisService.getOnlineUser();

      expect(mockRedisClient.sMembers).toHaveBeenCalledWith('online_users');
      expect(result).toEqual([1, 2]);
    });

    it('should return empty array when no online users', async () => {
      jest.spyOn(mockRedisClient, 'sMembers').mockResolvedValue([]);

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

      jest.spyOn(mockRedisClient, 'lPush').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'lTrim').mockResolvedValue('OK');
      jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);

      await redisService.cacheMessage(roomId, message);

      const key = 'room_messages:1';
      expect(mockRedisClient.lPush).toHaveBeenCalledWith(
        key,
        expect.any(String),
      );
      expect(mockRedisClient.lTrim).toHaveBeenCalledWith(key, 0, 9);
      expect(mockRedisClient.expire).toHaveBeenCalledWith(key, 86400);

      const stored = JSON.parse(
        (mockRedisClient.lPush as jest.Mock).mock.calls[0][1],
      );
      expect(stored).not.toHaveProperty('password');
      expect(stored.participant).not.toHaveProperty('password');
    });
  });

  describe('getCachedMessages', () => {
    it('should return null when cache is empty', async () => {
      jest.spyOn(mockRedisClient, 'lRange').mockResolvedValue([]);

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
      jest.spyOn(mockRedisClient, 'lRange').mockResolvedValue(entries);

      const result = await redisService.getCachedMessages(1);

      expect(mockRedisClient.lRange).toHaveBeenCalledWith(
        'room_messages:1',
        0,
        9,
      );
      expect(result).toHaveLength(2);
      expect(result![0].id).toBe(1);
      expect(result![1].id).toBe(2);
      expect(result![0].created).toBeInstanceOf(Date);
    });
  });
});
