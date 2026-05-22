import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomEntity } from './entities/room.entity';
import { ChatEntity } from './entities/chat.entity';
import { EntityManager, QueryRunner, Repository } from 'typeorm';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { SessionCacheService } from 'src/redis/redis.service';

describe('ChatService', () => {
  let mockSocket: Partial<Socket>;
  let mockManager: Partial<EntityManager>;
  let mockQueryRunner: Partial<QueryRunner>;

  let chatService: ChatService;
  let roomRepository: Repository<RoomEntity>;
  let userRepository: Repository<UserEntity>;
  let chatRepository: Repository<ChatEntity>;
  let redisService: SessionCacheService;

  beforeEach(async () => {
    //* Mock instances
    mockManager = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      innerJoin: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      getOne: jest.fn(),
    } as Partial<EntityManager>;

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn().mockReturnValue(mockManager),
      } as unknown,
    } as Partial<QueryRunner>;

    mockSocket = {
      id: '1',
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    } as Partial<Socket>;

    //* Import modules for mocking
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOneBy: jest.fn(),
            findOneByOrFail: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: {
            createQueryBuilder: jest.fn(),
            manager: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ChatEntity),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: SessionCacheService,
          useValue: {
            sethUserOnline: jest.fn(),
            sethUserOffline: jest.fn(),
            getUserStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    userRepository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    roomRepository = module.get<Repository<RoomEntity>>(getRepositoryToken(RoomEntity));
    chatRepository = module.get<Repository<ChatEntity>>(getRepositoryToken(ChatEntity));
    redisService = module.get(SessionCacheService);
  });

  //* Basic service initialization test
  it('should be defined', () => {
    expect(chatService).toBeDefined();
  });

  //* Clear each mocks after testing execution
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerClient', () => {
    it('should stores client as Redis hash', async () => {
      await chatService.registerClient(1, mockSocket as Socket);

      expect(redisService.sethUserOnline).toHaveBeenCalledWith(1, '1');
    });
  });

  describe('removeClient', () => {
    it('should removes client as Redis hash', async () => {
      await chatService.removeClient(1, mockSocket as Socket);

      expect(redisService.sethUserOffline).toHaveBeenCalledWith(1);
    });
  });

  describe('joinRooms', () => {
    it('should join rooms altogether', async () => {
      const mockUser = { sub: 1 };
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
        { id: 2, participants: 2, chats: 2 },
      ];

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRooms),
      };

      jest
        .spyOn(roomRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await chatService.joinRooms(mockUser, mockSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('1');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockSocket.join).toHaveBeenCalledTimes(2);
    });

    it('should throw WsException when a room has no id', async () => {
      const mockUser = { sub: 1 };
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: null }]),
      };

      jest.spyOn(roomRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await expect(chatService.joinRooms(mockUser, mockSocket as Socket)).rejects.toThrow(WsException);
    });

    it('should handle user with no rooms', async () => {
      const mockUser = { sub: 1 };
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest
        .spyOn(roomRepository, 'createQueryBuilder')
        .mockReturnValue(mockQueryBuilder as any);

      await chatService.joinRooms(mockUser, mockSocket as Socket);

      //* join should not be called
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });

  describe('findRoom', () => {
    it('should find a room where two user can join', async () => {
      const mockQB = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 1, participants: 1, chats: 1 }),
      };

      (mockQueryRunner.manager?.createQueryBuilder as jest.Mock).mockReturnValue(mockQB);

      const result = await chatService.findRoom(1, 2, mockQueryRunner as QueryRunner);

      expect(result).toEqual({ id: 1, participants: 1, chats: 1 });
      expect(mockQB.where).toHaveBeenCalledWith('participant1.id = :id1', { id1: 1 });
      expect(mockQB.andWhere).toHaveBeenCalledWith('participant2.id = :id2', { id2: 2 });
    });

    it('should return null if a room does not exist', async () => {
      const result = await chatService.findRoom(
        null!,
        null!,
        {} as QueryRunner,
      );

      expect(result).toBeNull();
    });
  });

  describe('createRoom', () => {
    it('should create and save a room', async () => {
      const user1 = { id: 1, email: 'user1@gmail.com', role: 0 } as UserEntity;
      const user2 = { id: 2, email: 'user2@gmail.com', role: 0 } as UserEntity;

      (mockQueryRunner.manager?.create as jest.Mock).mockReturnValue({ participants: [user1, user2], });
      (mockQueryRunner.manager?.save as jest.Mock).mockReturnValue({ id: 1, participants: 1, chats: 1 },);

      await chatService.createRoom(user1, user2, mockQueryRunner as unknown as QueryRunner);

      expect(mockQueryRunner.manager?.create).toHaveBeenCalledWith(RoomEntity, {
        participants: [user1, user2],
      });
      expect(mockQueryRunner.manager?.save).toHaveBeenCalled();
    });

    it('should throw WebSocket exception if the room id does not exist', async () => {
      const user1 = {
        id: 1,
        email: 'user1@gmail.com',
        password: 'pw',
        role: 0,
      } as UserEntity;
      const user2 = {
        id: 2,
        email: 'user1@gmail.com',
        password: 'pw',
        role: 0,
      } as UserEntity;

      // WsException returned with promise in service
      await expect(chatService.createRoom(user1, user2, mockQueryRunner as QueryRunner)).rejects.toThrow(WsException);
    });
  });

  describe('getOrCreateRoom', () => {
    it('should get a created room', async () => {
      //* the mock family
      const mockSender = {
        id: 1,
        email: 'user1@gmail.com',
        password: 'pw',
        role: 0,
      } as UserEntity;
      const mockRecipientId = 2;
      const mockRecipient = { id: 2 } as UserEntity;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;

      jest.spyOn(chatService, 'findRoom').mockResolvedValue(mockRooms);

      const result = await chatService.getOrCreateRoom(
        mockSender,
        mockRecipientId,
        mockQueryRunner as QueryRunner,
      );

      expect(chatService.findRoom).toHaveBeenCalledWith(
        mockSender.id,
        mockRecipient.id,
        mockQueryRunner as QueryRunner,
      );
      expect(result).toEqual(mockRooms);
    });

    it('should throw WsException when sender has no id', async () => {
      const senderWithoutId = { id: undefined } as unknown as UserEntity;

      await expect(
        chatService.getOrCreateRoom(senderWithoutId, 2, mockQueryRunner as QueryRunner),
      ).rejects.toThrow(WsException);
    });

    it("should create a room if it's non-existing", async () => {
      const mockSender = {
        id: 1,
        email: 'user1@gmail.com',
        password: 'pw',
        role: 0,
      } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockRecipient = { id: 1 } as UserEntity;

      jest.spyOn(chatService, 'findRoom').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);
      jest.spyOn(chatService, 'createRoom').mockResolvedValue(mockRooms);

      const result = await chatService.getOrCreateRoom(
        mockSender,
        mockRecipientId,
        mockQueryRunner as QueryRunner,
      );

      expect(chatService.findRoom).toHaveBeenCalledWith(
        1,
        2,
        mockQueryRunner,
      );
      expect(userRepository.findOneBy).toHaveBeenCalledWith({
        id: mockRecipientId,
      });
      expect(chatService.createRoom).toHaveBeenCalledWith(
        mockSender,
        mockRecipient,
        mockQueryRunner,
      );
      expect(result).toEqual(mockRooms);
    });

    it('should throw WebSocket exception if recipient does not exist', async () => {
      const mockSender = {
        id: 1,
        email: 'user1@gmail.com',
        password: 'pw',
        role: 0,
      } as UserEntity;
      const mockRecipientId = 2;

      jest.spyOn(chatService, 'findRoom').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(null);

      // WsException returned with promise in service
      await expect(chatService.getOrCreateRoom(mockSender, mockRecipientId, mockQueryRunner as QueryRunner)).rejects.toThrow(WsException);
    });

    it('should throw null if cannot connect to socket', async () => {
      const clientConnection = new Map<number, Socket>();

      expect(clientConnection).toBeInstanceOf(Map);
      expect(clientConnection.size).toBe(0);
    });

    it('should throw WebSocket exception if a room can not be found', async () => {
      const mockSender = {
        id: 1,
        email: 'user1@gmail.com',
        password: 'pw',
        role: 0,
      } as UserEntity;
      const mockRecipientId = 2;

      jest.spyOn(chatService, 'findRoom').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipientId as UserEntity);
      jest.spyOn(chatService, 'createRoom').mockResolvedValue({ id: null } as unknown as RoomEntity);
      //* Mocking 'getUserStatus' with `socketId` => Access to 'connect' => `room.id` condition throws WsException
      jest.spyOn(redisService, 'getUserStatus').mockResolvedValue({ socketId: 'socketId', status: 'online' });

      //* Accessed into Map of clientConnection to insert mock socket, thereby the condition throws WsException.
      chatService['clientConnection'].set('socketId', { emit: jest.fn(), join: jest.fn() } as unknown as Socket);

      // WsException returned with promise in service
      await expect(chatService.getOrCreateRoom(
        mockSender,
        mockRecipientId,
        mockQueryRunner as QueryRunner,
      )).rejects.toThrow(WsException);
    });

    it('should notify successful connection of users joining the created rooms', async () => {
      const mockSenderSocket = { emit: jest.fn(), join: jest.fn() } as unknown as Socket;
      const mockRecipientSocket = { emit: jest.fn(), join: jest.fn() } as unknown as Socket;

      const mockSender = {
        id: 1,
        email: 'user1@gmail.com',
        password: 'pw',
        role: 0,
      } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockRecipient = { id: 2 } as UserEntity;

      //* `let room = await this.findRoom(sender.id, recipientId, manager);`
      //* `const recipient = await this.userRepository.findOneBy({`
      //* `room = await this.createRoom(sender, recipient, manager);`
      jest.spyOn(chatService, 'findRoom').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);
      jest.spyOn(chatService, 'createRoom').mockResolvedValue(mockRooms);
      jest.spyOn(redisService, 'getUserStatus')
        .mockResolvedValueOnce({ socketId: '1', status: 'online' })
        .mockResolvedValueOnce({ socketId: '2', status: 'online' });

      //* [sender.id, recipient.id].forEach((id) => {
      //*    const connect = clientConnection.get(id);
      //* })
      chatService['clientConnection'].set('1', mockSenderSocket);
      chatService['clientConnection'].set('2', mockRecipientSocket);

      const result = await chatService.getOrCreateRoom(
        mockSender,
        mockRecipientId,
        mockQueryRunner as QueryRunner,
      );

      //* Notify and connect two of users
      //* connect?.join(room.id.toString());
      //* connect?.emit("CreateRoom", room.id.toString());
      expect(mockSenderSocket.emit).toHaveBeenCalledWith('CreateRoom', '1');
      expect(mockSenderSocket.join).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockRooms);
    });
  });

  describe('getRoom', () => {
    const mockQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    beforeEach(() => {
      jest.spyOn(roomRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
    });

    it('should return room id when room exists', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({ id: 5 });

      const result = await chatService.getRoom(1, 2);

      expect(result).toBe(5);
    });

    it('should return null when no room exists', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await chatService.getRoom(1, 2);

      expect(result).toBeNull();
    });

    it('should sort user ids before querying', async () => {
      mockQueryBuilder.getOne.mockResolvedValue({ id: 3 });

      await chatService.getRoom(5, 2);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('p1.id = :id1', { id1: 2 });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('p2.id = :id2', { id2: 5 });
    });
  });

  describe('getMessages', () => {
    const roomId = 1;
    const mockMessages = [
      { id: 1, message: 'hello', participant: { id: 2 }, room: { id: roomId } },
      { id: 2, message: 'world', participant: { id: 1 }, room: { id: roomId } },
    ];

    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    beforeEach(() => {
      jest.spyOn(chatRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
    });

    it('should return messages in ascending order', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([...mockMessages].reverse());

      const result = await chatService.getMessages(roomId);

      expect(chatRepository.createQueryBuilder).toHaveBeenCalledWith('chat');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('chat.room = :roomId', { roomId });
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(15);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('should apply cursor when provided', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockMessages[0]]);

      await chatService.getMessages(roomId, 2);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('chat.id < :cursor', { cursor: 2 });
    });

    it('should return empty array when no messages exist', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await chatService.getMessages(roomId);

      expect(result).toEqual([]);
    });
  });

  describe('sendMessage', () => {
    it('should send message through successfully commit transaction', async () => {
      const mockPayload = { sub: 1 };
      const mockCreateChatDto: CreateChatDto = {
        message: 'a message',
        recipientId: 2,
        room: 1,
      };
      const mockSender = { id: mockPayload.sub } as UserEntity;
      const mockRecipient = 1;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockMessage = {
        id: 100,
        message: 'a message',
        participant: mockSender,
        room: mockRooms,
      };
      //* Inject socket in 'clientConnection'
      const mockSenderSocket = { to: jest.fn().mockReturnThis(), emit: jest.fn(), join: jest.fn() } as unknown as Socket;

      chatService['clientConnection'].set('socketId', mockSenderSocket);
      chatService['clientConnection'].set('recipientId', { emit: jest.fn(), join: jest.fn() } as unknown as Socket);

      //* Mock all dependencies
      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(chatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);
      jest.spyOn(mockQueryRunner.manager as EntityManager, 'save').mockResolvedValue(mockMessage);
      jest.spyOn(redisService, 'getUserStatus')
        .mockResolvedValueOnce({ socketId: '1', status: 'online' })
        .mockResolvedValueOnce({ socketId: '2', status: 'online' });

      //* Mock creating a room
      await chatService.getOrCreateRoom(
        mockSender,
        mockRecipient,
        mockQueryRunner as QueryRunner,
      );

      //* Final result
      const result = await chatService.sendMessage(
        mockPayload,
        mockCreateChatDto,
        mockQueryRunner as QueryRunner,
      );

      expect(result).toEqual(mockMessage);
    });

    it('should find sender socketId in Redis', async () => {
      const mockPayload = { sub: 1 };

      const mockCreateChatDto: CreateChatDto = {
        message: 'a message',
        recipientId: 2,
        room: 0,
      };
      const mockSender = { id: mockPayload.sub } as UserEntity;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockMessage = {
        id: 1,
        message: 'a message',
        participant: mockSender,
        room: mockRooms,
      };
      //* Inject socket in 'clientConnection'
      const mockSenderSocket = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        join: jest.fn()
      } as unknown as Socket;

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(chatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);
      jest.spyOn(mockQueryRunner.manager as EntityManager, 'save').mockResolvedValue(mockMessage);
      jest.spyOn(redisService, 'getUserStatus')
        .mockResolvedValueOnce({ socketId: '1', status: 'online' })
        .mockResolvedValueOnce({ socketId: '2', status: 'online' });

      chatService['clientConnection'].set('1', mockSenderSocket);
      chatService['clientConnection'].set('2', mockSenderSocket);

      await chatService.sendMessage(
        mockPayload,
        mockCreateChatDto,
        mockQueryRunner as QueryRunner,
      );

      const emittedData = (mockSenderSocket.emit as jest.Mock).mock.calls[0][1];
      expect(emittedData).toHaveProperty('id', 1);
      expect(emittedData).toHaveProperty('message', 'a message');
    });

    it('should throw WsException when recipientId is invalid', async () => {
      const payload = { sub: 1 };
      const mockSender = { id: 1 } as UserEntity;

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(chatService, 'getOrCreateRoom').mockResolvedValue({ id: 1 } as RoomEntity);

      await expect(
        chatService.sendMessage(payload, { message: 'hi', recipientId: NaN }, mockQueryRunner as QueryRunner),
      ).rejects.toThrow(WsException);
    });

    it('should rollback to release if sender does not exist then rollback to release', async () => {
      const mockPayload = { sub: 1 };
      const mockCreateChatDto: CreateChatDto = {
        message: 'a message',
        recipientId: 2,
        room: 0,
      };

      jest
        .spyOn(userRepository, 'findOneByOrFail')
        .mockRejectedValue(new WsException('Cannot Find Sender'));

      await expect(chatService.sendMessage(mockPayload, mockCreateChatDto, mockQueryRunner as QueryRunner)).rejects.toThrow(WsException);
    });

    it('should throw WebSocket exception if recipient does not exist then rollback to release', async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = {
        message: 'a message',
        recipientId: 2,
        room: 0,
      };
      const mockSender = { id: 1 } as UserEntity;
      const mockRecipient = { id: 2 } as UserEntity;

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);

      // 'WsException' returned with promise in service
      await expect(chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner)).rejects.toThrow(WsException);
    });

    it('should save message and return it even when recipient is offline', async () => {
      const payload = { sub: 1 };
      const mockSender = { id: 1 } as UserEntity;
      const createChatDto: CreateChatDto = {
        message: 'a message',
        recipientId: 2,
        room: 1,
      };
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockMessage = {
        id: 100,
        message: 'a message',
        participant: mockSender,
        room: mockRooms,
      };

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(chatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);
      jest.spyOn(mockQueryRunner.manager as EntityManager, 'save').mockResolvedValue(mockMessage);
      jest.spyOn(redisService, 'getUserStatus')
        .mockResolvedValueOnce({ socketId: undefined, status: 'offline' })
        .mockResolvedValueOnce({ socketId: undefined, status: 'offline' });

      const result = await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner);

      expect(result).toEqual(mockMessage);
    });
  });
});
