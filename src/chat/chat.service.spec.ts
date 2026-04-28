import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomEntity } from './entities/room.entity';
import { EntityManager, QueryBuilder, QueryRunner, Repository } from 'typeorm';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { SessionCacheService } from 'src/redis/redis.service';

describe('ChatService', () => {
  let mockSocket: Partial<Socket>;
  let mockManager: Partial<EntityManager>;
  let mockQueryBuilder: Partial<EntityManager>;
  let mockQueryRunner: Partial<QueryRunner>;

  let chatService: ChatService;
  let roomRepository: Repository<RoomEntity>;
  let userRepository: Repository<UserEntity>;
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
    userRepository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
    roomRepository = module.get<Repository<RoomEntity>>(
      getRepositoryToken(RoomEntity),
    );
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
      // const mockRooms = [
      //   { id: 1, participants: 1, chats: 1 },
      //   { id: 2, participants: 2, chats: 2 },
      // ];
      // const mockQB = {
      //   innerJoin: jest.fn(),
      //   where: jest.fn(),
      //   andWhere: jest.fn(),
      //   getOne: jest.fn(),
      // };

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
      // const mockManager = {
      //   create: jest.fn(),
      //   save: jest.fn(),
      // };

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
      // const mockClientConnection = new Map<number, Socket>();
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
      // expect(mockRecipientSocket.emit).toHaveBeenCalledWith('CreateRoom', '2');
      // expect(mockRecipientSocket.join).toHaveBeenCalledWith('2');
      expect(result).toEqual(mockRooms);
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

      // Mock creating a room
      await chatService.getOrCreateRoom(
        mockSender,
        mockRecipient,
        mockQueryRunner as QueryRunner,
      );

      // Final result
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
        id: 100,
        message: 'a message',
        participant: mockSender,
        room: mockRooms,
      };
      //* Inject socket in 'clientConnection'
      const mockSenderSocket = { to: jest.fn().mockReturnThis(), emit: jest.fn(), join: jest.fn() } as unknown as Socket;

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(chatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);
      jest.spyOn(mockQueryRunner.manager as EntityManager, 'save').mockResolvedValue(mockMessage);
      jest.spyOn(redisService, 'getUserStatus')
        .mockResolvedValueOnce({ socketId: '1', status: 'online' })
        .mockResolvedValueOnce({ socketId: '2', status: 'online' });

      chatService['clientConnection'].set('socketId', mockSenderSocket);

      await chatService.sendMessage(
        mockPayload,
        mockCreateChatDto,
        mockQueryRunner as QueryRunner,
      );

      const emittedData = (mockSocket.emit as jest.Mock).mock.calls[0][1];
      expect(emittedData).toHaveProperty('id', 1);
      expect(emittedData).toHaveProperty('message', 'a message');
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

      jest
        .spyOn(userRepository, 'findOneByOrFail')
        .mockResolvedValue(mockSender);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);

      // 'WsException' returned with promise in service
      await expect(chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner)).rejects.toThrow(WsException);
    });

    it('should throw null if connect to socket', async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = {
        message: 'a message',
        recipientId: 2,
        room: 1,
      };

      const mockRecipient = { id: 2 };
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
        { id: 2, participants: 2, chats: 2 },
      ] as any;

      jest.spyOn(chatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);

      await chatService.sendMessage(
        payload,
        createChatDto,
        mockQueryRunner as QueryRunner,
      );

      // WsException returned with promise in service
      await expect(mockRecipient).rejects.toThrow(WsException);
    });
  });
});
