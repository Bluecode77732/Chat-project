import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SessionCacheService } from './redis.service';
import { RedisClientType } from 'redis';

describe('SessionCacheService', () => {
  let redisService: SessionCacheService;
  // let mockRedisClient: jest.Mocked<RedisClientType>;
  let mockRedisClient: Partial<RedisClientType>;

  mockRedisClient = {
    // redis.hSet(`user:${userId}`, { socketId, status: 'online' });
    // redis.hSet(`user:${userId}`, 'status', 'offline');
    hSet: jest.fn(),
    // redis.expire(`user:${userId}`, 86400);
    expire: jest.fn(),
    // redis.hGetAll(`user:${userId}`);
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

      // jest.spyOn(redisService, 'sethUserOnline').mockReturnValue(mockUserId, mockSocketId);
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
      // jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);

      // jest.spyOn(redisService, 'sethUserOnline').mockReturnValue(mockUserId, mockSocketId);
      await redisService.sethUserOnline(mockUserId, mockSocketId);

      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user1', mockField);
    });
  });
  
  
  describe("getUserStatus", () => {
    it("should get user socketId from Redis hashed data", async () => {
      // const data = await this.redis.hGetAll(`user:${userId}`);
      // return data.socketId ? data : null;

      const mockUserId = 1;
      const mockUserData = {mockUserId, };
      const mockSocketId = 'mVkMdDQwpyoiEsDqSocketId';
      const mockField = { mockSocketId, status: "online" };
  
      jest.spyOn(mockRedisClient, 'hSet').mockResolvedValue(1);
      // jest.spyOn(mockRedisClient, 'expire').mockResolvedValue(1);
  
      // jest.spyOn(redisService, 'sethUserOnline').mockReturnValue(mockUserId, mockSocketId);
      await redisService.sethUserOnline(mockUserId, mockSocketId);
  
      expect(mockRedisClient.hSet).toHaveBeenCalledWith('user1', mockField);
    });
    
    // it('should update a new user.', async () => {
    //   const updateUserDto: UpdateUserDto = {
    //     email: "email@gamil.com",
    //     password: "PrivatePassword",
    //   };

    //   const genSalt = 10;
    //   const userId = 1;
    //   const email = "email@gamil.com";
    //   const hashed = genSalt;

    //   const user = {
    //     id: userId,
    //     email: email,
    //     password: hashed,
    //   };

    //   jest.spyOn(mockUserRepository, 'findOne')
    //     .mockResolvedValueOnce(user)
    //     .mockResolvedValueOnce({ ...user, password: hashed });
    //   jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue(genSalt);
    //   jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve(hashed));
    //   jest.spyOn(mockUserRepository, 'update').mockImplementation(() => Promise.resolve(user));

    //   const updatedUser = await userService.update(userId, updateUserDto);

    //   expect(updatedUser).toEqual({ ...user, password: hashed });
    //   expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 }, });
    //   expect(bcrypt.hash).toHaveBeenCalledWith(updateUserDto.password, genSalt);
    //   expect(mockUserRepository.update).toHaveBeenCalledWith(
    //     { id: 1 },
    //     {
    //       email: updateUserDto.email,
    //       password: hashed,
    //     },
    //   );
    // });

    //   it("should throw a NotFoundException when the user doesn't exist.", async () => {
    //     const updateUserDto: UpdateUserDto = {
    //       email: "email@gamil.com",
    //       password: "PrivatePassword",
    //     };

    //     jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

    //     expect(userService.update(1, updateUserDto)).rejects.toThrow(NotFoundException);
    //     expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    //     expect(mockUserRepository.update).not.toHaveBeenCalled();
    //   });
  });
});
