import { Test, TestingModule } from '@nestjs/testing';
import { SessionCacheService } from './redis.service';
import { RedisClientType } from 'redis';

describe('SessionCacheService', () => {
  let redisService: SessionCacheService;
  let mockRedisClient: Partial<RedisClientType>;

  mockRedisClient = {
    //* redis.hSet(`user:${userId}`, { socketId, status: 'online' }); */
    //* redis.hSet(`user:${userId}`, 'status', 'offline'); */
    hSet: jest.fn(),
    //* redis.expire(`user:${userId}`, 86400); */
    expire: jest.fn(),
    //* redis.hGetAll(`user:${userId}`); */
    hGetAll: jest.fn(),
  } as Partial<RedisClientType>;


  beforeEach(async () => {
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


  describe("sethUserOnline", () => {
    it("should store user data as Redis hash", async () => {
      const mockUserId = 1;
      const mockSocketId = 'mVkMdDQwpyoiEsDqSocketId';
      const mockField = { mockSocketId, status: "online" };

      jest.spyOn(mockRedisClient, 'hSet').mockResolvedValue(1);
      jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);

      await redisService.sethUserOnline(mockUserId, mockSocketId);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user1', mockField);
    });
  });

  describe("sethUserOffline", () => {
    it("should update `status` field only without deleting socketId", async () => {
      const mockUserId = 1;
      const mockSocketId = 'mVkMdDQwpyoiEsDqSocketId';
      const mockField = { mockSocketId, status: "online" };

      jest.spyOn(mockRedisClient, 'hSet').mockResolvedValue(1);

      await redisService.sethUserOffline(mockUserId);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user1', mockField);
    });
  });


  describe("getUserStatus", () => {
    it("should get user socketId from Redis hashed data", async () => {
      
      const mockUserId = 1;
      const mockSocketId = 'mVkMdDQwpyoiEsDqSocketId';
      const mockField = { mockSocketId, status: "online" };
      
      const result = await redisService.getUserStatus(mockUserId);
      
      //* const data = await this.redis.hGetAll(`user:${userId}`); */
      //* return data.socketId ? data : null; */
      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user1', mockField);
      expect(result).toEqual(mockField);
    });
  });
});
