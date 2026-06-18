import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { ConfigService } from '@nestjs/config';
import { SessionCacheService } from 'src/redis/redis.service';
import { ChatService } from 'src/chat/chat.service';
import { AuditLogService } from 'src/audit-log/audit-log.service';
import { MailService } from 'src/mail/mail.service';
import { UserRole } from 'src/auth/role/role';
import * as bcrypt from 'bcrypt';

describe('UserService', () => {
  let userService: UserService;

  const mockUserRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
  };

  const mockRoomQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(1),
  };

  const mockRoomRepository = {
    createQueryBuilder: jest.fn(() => mockRoomQueryBuilder),
    delete: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  };

  const mockRedisClient = {
    del: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockSessionCacheService = {
    getUserStatus: jest.fn().mockResolvedValue(null),
    sethUserOffline: jest.fn().mockResolvedValue(undefined),
  };

  const mockChatService = {
    disconnectSocket: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockMailService = {
    sendRoleChangeEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: mockRoomRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
        {
          provide: SessionCacheService,
          useValue: mockSessionCacheService,
        },
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  // Clears the mock.calls and mock.instances properties of all mocks.
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user.', async () => {
      const createUserDto: CreateUserDto = {
        email: 'email@gamil.com',
        password: 'PrivatePassword',
      };

      const genSalt = 10;
      const email = 'email@gamil.com';
      const hashed = genSalt;

      const result = {
        // id: userId,
        email: email,
        password: hashed,
        role: 0,
      };

      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue(genSalt);

      // Since jest.spyOn cannot test out `bcrypt` as jest-mock@30 + Node 24 is restricted environment.
      // jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve(hashed));
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashed);

      // Inserting `null` does explicitly include the 'failed search'.
      jest
        .spyOn(mockUserRepository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(result);

      const newUser = await userService.create(createUserDto);

      expect(newUser).toEqual(result);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, genSalt);
      expect(mockUserRepository.save).toHaveBeenCalledWith({
        email: createUserDto.email,
        password: hashed,
        role: 0,
      });
    });

    it('should throw a BadRequestException when the user already exist.', async () => {
      const createUserDto: CreateUserDto = {
        email: 'email@gamil.com',
        password: 'PrivatePassword',
      };

      jest
        .spyOn(mockUserRepository, 'findOne')
        .mockResolvedValue({ id: 1, email: createUserDto.email });

      expect(userService.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserRepository.save).not.toHaveBeenCalledWith();
    });
  });

  describe('update', () => {
    it('should update a new user.', async () => {
      const updateUserDto: UpdateUserDto = {
        email: 'email@gamil.com',
        password: 'PrivatePassword',
      };

      const genSalt = 10;
      const userId = 1;
      const email = 'email@gamil.com';
      const hashed = genSalt;

      const user = {
        id: userId,
        email: email,
        password: 'PrivatePassword',
      };

      jest
        .spyOn(mockUserRepository, 'findOne')
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, password: 'PrivatePassword' });
      jest.spyOn(mockConfigService, 'getOrThrow').mockReturnValue(genSalt);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve(hashed));
      jest
        .spyOn(mockUserRepository, 'update')
        .mockImplementation(() => Promise.resolve(user));

      const updatedUser = await userService.update(userId, updateUserDto);

      expect(updatedUser).toEqual({ ...user, password: 'PrivatePassword' });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(user.password, hashed);
      expect(mockRedisClient.del).toHaveBeenCalledWith(`user_cache:${userId}`);
      // (bcrypt.hash as jest.Mock).mockResolvedValue(hashed);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: 1 },
        {
          email: updateUserDto.email,
          password: updateUserDto.password,
        },
      );
    });

    it("should throw a NotFoundException when the user doesn't exist.", async () => {
      const updateUserDto: UpdateUserDto = {
        email: 'email@gamil.com',
        password: 'PrivatePassword',
      };

      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      expect(userService.update(1, updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw a BadRequestException when the nickname is already taken by another user.', async () => {
      const userId = 1;
      const user = { id: userId, email: 'email@gamil.com', nickname: 'Old' };
      const otherUser = { id: 2, nickname: 'Taken' };

      jest
        .spyOn(mockUserRepository, 'findOne')
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(otherUser);

      await expect(
        userService.update(userId, { nickname: 'Taken' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should allow keeping the same nickname without a uniqueness conflict.', async () => {
      const userId = 1;
      const user = { id: userId, email: 'email@gamil.com', nickname: 'Same' };

      jest
        .spyOn(mockUserRepository, 'findOne')
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(user);
      jest.spyOn(mockUserRepository, 'update').mockResolvedValue(undefined);

      await userService.update(userId, { nickname: 'Same' });

      expect(mockUserRepository.update).toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    const actorId = 9;
    const targetId = 1;
    const target = {
      id: targetId,
      email: 'target@gmail.com',
      role: UserRole.user,
    };

    it('updates the role and sends a role-change email to the target.', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(target);

      const result = await userService.updateRole(
        actorId,
        targetId,
        UserRole.admin,
      );

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: targetId },
        { role: UserRole.admin },
      );
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        actorId,
        targetId,
        'ROLE_CHANGE',
        'user→admin',
      );
      expect(mockMailService.sendRoleChangeEmail).toHaveBeenCalledWith(
        target.email,
        UserRole.user,
        UserRole.admin,
      );
      expect(result.role).toBe(UserRole.admin);
    });

    it('still updates the role when the email fails to send.', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(target);
      mockMailService.sendRoleChangeEmail.mockRejectedValueOnce(
        new Error('SMTP down'),
      );

      const result = await userService.updateRole(
        actorId,
        targetId,
        UserRole.admin,
      );

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: targetId },
        { role: UserRole.admin },
      );
      expect(result.role).toBe(UserRole.admin);
    });

    it('throws a NotFoundException when the target user does not exist.', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      await expect(
        userService.updateRole(actorId, targetId, UserRole.admin),
      ).rejects.toThrow(NotFoundException);
      expect(mockMailService.sendRoleChangeEmail).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const userId = 1;
    const user = { id: userId, password: 'hashed' };

    it("should throw a NotFoundException when the user doesn't exist.", async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(null);

      await expect(userService.remove(99, userId, 'pw')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw a BadRequestException when self-deletion is missing a password.', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);

      await expect(userService.remove(userId, userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw a BadRequestException when the password does not match.', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        userService.remove(userId, userId, 'wrong-password'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete the user, clean up sessions, blacklist the token, and log the audit entry.', async () => {
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockRoomQueryBuilder.getMany.mockResolvedValueOnce([{ id: 10 }]);
      mockRoomQueryBuilder.getCount.mockResolvedValueOnce(0); // room 10 becomes orphaned
      mockSessionCacheService.getUserStatus.mockResolvedValueOnce({
        socketId: 'socket-1',
      });
      mockConfigService.get.mockReturnValue(900);

      const result = await userService.remove(
        userId,
        userId,
        'correct-password',
        'Bearer token-abc',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        user.password,
      );
      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
      // orphaned room 10 cleaned up
      expect(mockRoomRepository.delete).toHaveBeenCalledWith(10);
      expect(mockRedisClient.del).toHaveBeenCalledWith('room_messages:10');
      // session cleanup
      expect(mockSessionCacheService.sethUserOffline).toHaveBeenCalledWith(
        userId,
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(`user:${userId}`);
      // token blacklist
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'blacklist:token-abc',
        '1',
        'EX',
        900,
      );
      // socket force-disconnect
      expect(mockChatService.disconnectSocket).toHaveBeenCalledWith('socket-1');
      // audit log
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        userId,
        userId,
        'USER_DELETE',
      );
      expect(result).toBe(`The user ${userId} is deleted`);
    });

    it('should allow an admin to delete another user without a password.', async () => {
      const actorId = 2; // admin
      jest.spyOn(mockUserRepository, 'findOne').mockResolvedValue(user);

      const result = await userService.remove(
        actorId,
        userId,
        undefined,
        undefined,
        true, // skipPasswordCheck
      );

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        actorId,
        userId,
        'USER_DELETE',
      );
      expect(result).toBe(`The user ${userId} is deleted`);
    });
  });
});
