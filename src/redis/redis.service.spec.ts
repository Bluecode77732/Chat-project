import { Test, TestingModule } from '@nestjs/testing';
import { SessionCacheService } from './redis.service';
import { RedisClientType } from 'redis';

describe('SessionCacheService', () => {
  let redisService: SessionCacheService;
  let mockRedisClient: Partial<RedisClientType>;

  beforeEach(async () => {
    mockRedisClient = {
      //* redis.hSet(`user:${userId}`, { socketId, status: 'online' }); */
      //* redis.hSet(`user:${userId}`, 'status', 'offline'); */
      hSet: jest.fn(),
      //* redis.expire(`user:${userId}`, 86400); */
      expire: jest.fn(),
      //* redis.hGetAll(`user:${userId}`); */
      hGetAll: jest.fn(),
      keys: jest.fn(),
    } as Partial<RedisClientType>;

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

  // Clears the mock.calls and mock.instances properties of all mocks.
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sethUserOnline', () => {
    it('should store user data as Redis hash', async () => {
      const mockUserId = 1;
      const socketId = 'mVkMdDQwpyoiEsDqSocketId';

      jest.spyOn(mockRedisClient, 'hSet').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);

      await redisService.sethUserOnline(mockUserId, socketId);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user:1', { socketId, status: 'online' });
    });
  });

  describe('sethUserOffline', () => {
    it('should update `status` field only without deleting socketId', async () => {
      const mockUserId = 1;
      const socketId = 'mVkMdDQwpyoiEsDqSocketId';

      jest.spyOn(mockRedisClient, 'hSet').mockResolvedValue(1);

      await redisService.sethUserOffline(mockUserId);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user:1', "status", "offline");
    });
  });

  describe('getUserStatus', () => {
    it('should get user socketId from Redis hashed data', async () => {
      const mockUserId = 1;
      const socketId = 'mVkMdDQwpyoiEsDqSocketId';

      jest.spyOn(mockRedisClient, "hGetAll").mockResolvedValue({ socketId, status: 'online' });

      await redisService.getUserStatus(mockUserId);

      //* const data = await this.redis.hGetAll(`user:${userId}`); */
      //* return data.socketId ? data : null; */
      expect(mockRedisClient.hGetAll).toHaveBeenCalledWith("user:1");
    });
  });

  describe('getOnlineUser', () => {
    it('should return online user ids', async () => {
      const mockKeys = ['user:1', 'user:2'];

      jest.spyOn(mockRedisClient, "keys").mockResolvedValue(mockKeys);
      jest.spyOn(mockRedisClient, "hGetAll")
        .mockResolvedValueOnce({ socketId: 'abc', status: 'online' })
        .mockResolvedValueOnce({ socketId: 'def', status: 'online' });

      const result = await redisService.getOnlineUser();

      expect(mockRedisClient.keys).toHaveBeenCalledWith("user:*");
      expect(result).toEqual([1, 2]);
    });

    it('should return empty array when no online users', async () => {
      jest.spyOn(mockRedisClient, "keys").mockResolvedValue(['user:1']);
      jest.spyOn(mockRedisClient, "hGetAll").mockResolvedValueOnce({ socketId: 'abc', status: 'offline' }).mockResolvedValueOnce({ socketId: 'def', status: 'offline' }).mockResolvedValueOnce({ socketId: 'ghi', status: 'offline' });

      const result = await redisService.getOnlineUser();

      expect(result).toEqual([]);
    });

    it('should return null when getUserStatus throws error', async () => {
      jest.spyOn(mockRedisClient, "hGetAll").mockRejectedValue(new Error('Redis error'));

      const result = await redisService.getUserStatus(1);

      expect(result).toBeNull();
    });
  });
});
