import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomEntity } from './entities/room.entity';
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
  let redisService: SessionCacheService;


  beforeEach(async () => {
    //* Mock instances
    mockSocket = {
      emit: jest.fn(),
      to: jest.fn(),
      join: jest.fn(),
    } as Partial<Socket>;

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
      },
    } as Partial<EntityManager>;

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
    userRepository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    roomRepository = module.get<Repository<RoomEntity>>(getRepositoryToken(RoomEntity));
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


  describe("registerClient", () => {
    it("should stores client as Redis hash", async () => {
      await chatService.registerClient(1, mockSocket as Socket);

      expect(redisService.sethUserOnline).toHaveBeenCalledWith(1, '1');
    });
  });


  describe("removeClient", () => {
    it("should removes client as Redis hash", async () => {
      await chatService.removeClient(1, mockSocket as Socket);

      expect(redisService.sethUserOffline).toHaveBeenCalledWith(1);
    });
  });


  describe("joinRooms", () => {
    it("should join rooms altogether", async () => {
      const mockUser = { sub: 1 };
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
        { id: 2, participants: 2, chats: 2 },
      ];

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRooms),
      };

      jest.spyOn(roomRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

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

      jest.spyOn(roomRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      await chatService.joinRooms(mockUser, mockSocket as Socket);

      //* join should not be called
      expect(mockSocket.join).not.toHaveBeenCalled();
    });
  });


  describe("findRoom", () => {
    it("should find a room where two user can join", async () => {
      const mockManager = {
        createQueryBuilder: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      };
      const result = await chatService.findRoom(1, 2, {} as QueryRunner);
      const mockRooms = [{ id: 1, participants: 1, chats: 1 }];

      expect(result).toEqual(mockRooms);
      expect(mockManager.where).toHaveBeenCalledWith("participant1.id = :id1", { id1: [0] });
      expect(mockManager.andWhere).toHaveBeenCalledWith("participant2.id = :id2", { id2: [1] });
    });

    it("should return null if a room does not exist", async () => {
      const result = await chatService.findRoom(null!, null!, {} as QueryRunner);

      expect(result).toBeNull();
    });
  });


  describe("createRoom", () => {
    it("should create and save a room", async () => {
      const user1 = { id: 1, email: "user1@gmail.com", role: 0 } as UserEntity;
      const user2 = { id: 2, email: "user1@gmail.com", role: 0 } as UserEntity;
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
        { id: 2, participants: 2, chats: 2 },
      ];
      const mockManager = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const result = await chatService.createRoom(user1, user2, mockManager as any);

      expect(mockManager.create).toHaveBeenCalledWith(RoomEntity, { participants: [1, 2] });
      expect(mockManager.save).toHaveBeenCalledWith(mockRooms);
      expect(result).toEqual(mockRooms);
    });

    it("should throw WebSocket exception if the room id does not exist", async () => {
      const user1 = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const user2 = { id: 2, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockManager = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const result = await chatService.createRoom(user1, user2, mockManager as any);

      // WsException returned with promise in service
      await expect(result).rejects.toThrow(WsException);
    });
  });


  describe("getOrCreateRoom", () => {
    it("should get a created room", async () => {
      //* the mock family
      const mockSender = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockRecipient = { id: 1 } as UserEntity;

      jest.spyOn(chatService, 'findRoom').mockResolvedValue(mockRooms);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);

      const result = await chatService.getOrCreateRoom(mockSender, mockRecipientId, mockQueryRunner as QueryRunner);

      expect(chatService.findRoom).toHaveBeenCalledWith(mockSender.id, mockSender.id, mockManager as EntityManager);
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: mockRecipientId });
      expect(result).toEqual(mockRooms);
    });


    it("should create a room if it's non-existing", async () => {
      const mockSender = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockRecipient = ({ id: 1 }) as UserEntity;

      jest.spyOn(chatService, 'findRoom').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);
      jest.spyOn(chatService, 'createRoom').mockResolvedValue(mockRooms);

      const result = await chatService.getOrCreateRoom(mockSender, mockRecipientId, mockQueryRunner as QueryRunner);

      expect(chatService.findRoom).toHaveBeenCalledWith(1, 2, mockManager as EntityManager);
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: mockRecipientId });
      expect(chatService.createRoom).toHaveBeenCalledWith(mockSender, mockRecipient, mockManager as EntityManager);
      expect(result).toEqual(mockRooms);
    });


    it("should throw WebSocket exception if recipient does not exist", async () => {
      const mockSender = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockRecipientId = 2;

      jest.spyOn(chatService, 'findRoom').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(null);

      const result = await chatService.getOrCreateRoom(mockSender, mockRecipientId, mockQueryRunner as QueryRunner);

      // WsException returned with promise in service
      await expect(result).rejects.toThrow(WsException);
    });


    it("should throw null if cannot connect to socket", async () => {
      const clientConnection = new Map<number, Socket>();

      expect(clientConnection).toBeNull();
    });


    it("should throw WebSocket exception if a room can not be found", async () => {
      const mockSender = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockRecipient = { id: 1 } as UserEntity;


      jest.spyOn(chatService, 'createRoom').mockResolvedValue(mockRooms);

      const room = await chatService.getOrCreateRoom(mockSender, mockRecipientId, mockQueryRunner as QueryRunner);

      expect(chatService.createRoom).toHaveBeenCalledWith(mockSender, mockRecipient, mockManager);
      // WsException returned with promise in service
      await expect(room?.id).rejects.toThrow(WsException);
    });


    it("should notify successful connection of users joining the created rooms", async () => {
      const mockClientConnection = new Map<number, Socket>();
      const mockSenderSocket = { id: '1' } as Socket;
      const mockRecipientSocket = { id: '2' } as Socket;

      const mockSender = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockRecipient = await userRepository.findOneBy({ id: mockRecipientId }) as UserEntity;

      //* [sender.id, recipient.id].forEach((id) => {
      //*    const connect = clientConnection.get(id);
      //* })
      mockClientConnection.set(1, mockSenderSocket);
      mockClientConnection.set(2, mockRecipientSocket);
      mockClientConnection.get(1);
      mockClientConnection.get(2);

      //* let room = await this.findRoom(sender.id, recipientId, manager);
      //* const recipient = await this.userRepository.findOneBy({
      //* room = await this.createRoom(sender, recipient, manager);
      jest.spyOn(chatService, 'findRoom').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);
      jest.spyOn(chatService, 'createRoom').mockResolvedValue(mockRooms);

      const result = await chatService.getOrCreateRoom(mockSender, mockRecipientId, mockQueryRunner as QueryRunner);

      //* Notify and connect two of users
      //* connect?.join(room.id.toString());
      //* connect?.emit("CreateRoom", room.id.toString());
      expect(mockSenderSocket.emit).toHaveBeenCalledWith("CreateRoom", "1");
      expect(mockSenderSocket.join).toHaveBeenCalledWith('1');
      expect(mockRecipientSocket.emit).toHaveBeenCalledWith("CreateRoom", "2");
      expect(mockRecipientSocket.join).toHaveBeenCalledWith('2');
      expect(result).toEqual(mockRooms);
    });
  });


  describe("sendMessage", () => {
    it("should send message through successfully commit transaction", async () => {
      const mockPayload = { sub: 1 };
      const mockCreateChatDto: CreateChatDto = { message: "a message", recipientId: 2, room: 1 };
      const mockSender = { id: mockPayload.sub } as UserEntity;
      const mockRecipient = 1;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockMessage = {
        id: 100,
        message: 'a message',
        participant: mockSender,
        room: mockRooms,
      };
      const mockMessageSchema = {
        participant: mockSender,
        mockMessage,
        room: mockRooms,
      };

      // Mock all dependencies
      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(chatService as ChatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);
      jest.spyOn(mockQueryRunner.manager as EntityManager, 'save').mockResolvedValue(mockMessageSchema);
      jest.spyOn(redisService as SessionCacheService, 'getUserStatus').mockResolvedValue(mockSender.id as { socketId?: string, status?: string } | null);
      jest.spyOn(redisService as SessionCacheService, 'getUserStatus').mockResolvedValue(mockRecipient as { socketId?: string, status?: string } | null);

      // Mock creating a room
      await chatService.getOrCreateRoom(mockSender, mockRecipient, mockQueryRunner as QueryRunner);

      // Final result
      const result = await chatService.sendMessage(mockPayload, mockCreateChatDto, mockQueryRunner as QueryRunner);

      expect(result).toBe('Hello World!');
    });

    it("should find sender socketId in Redis", async () => {
      const mockPayload = { sub: 1 };
      const mockCreateChatDto: CreateChatDto = { message: "a message", recipientId: 2, room: 0 };
      const mockSender = { id: 1 } as UserEntity;

      chatService['clientConnection'].get('r3kaf1hmNAml');

      jest.spyOn(redisService, 'getUserStatus').mockResolvedValue(mockSender as { socketId?: string | undefined; status?: string | undefined; } | null);

      await chatService.sendMessage(mockPayload, mockCreateChatDto, mockQueryRunner as QueryRunner)

      const emittedData = (mockSocket.emit as jest.Mock).mock.calls[0][1];
      expect(emittedData).toHaveProperty('id', 1);
      expect(emittedData).toHaveProperty('message', 'sending messageSchema');
    });

    it("should rollback to release if sender does not exist then rollback to release", async () => {
      const mockPayload = { sub: 1 };
      const mockCreateChatDto: CreateChatDto = { message: "a message", recipientId: 2, room: 0 };

      jest.spyOn(userRepository, 'findOneByOrFail').mockRejectedValue(new WsException("Cannot Find Sender"));

      await chatService.sendMessage(mockPayload, mockCreateChatDto, mockQueryRunner as QueryRunner);

      // Rollbacks transaction when fails
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      // Releases transaction from fails
      expect(mockQueryRunner.release).toHaveBeenCalled();
      // Transaction has not called
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it("should throw WebSocket exception if recipient does not exist then rollback to release", async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = {
        message: "a message",
        recipientId: 2,
        room: 0
      };
      const mockSender = { id: 1 } as UserEntity;
      const mockRecipient = { id: 2 } as UserEntity;

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(mockSender);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);

      await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      // WsException returned with promise in service
      await expect(mockRecipient).rejects.toThrow(WsException);
    });

    it("should throw null if connect to socket", async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = {
        message: "a message",
        recipientId: 2,
        room: 1
      };

      const mockRecipient = { id: 2 };
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
        { id: 2, participants: 2, chats: 2 },
      ] as any;

      jest.spyOn(chatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);

      await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).rejects.toHaveBeenCalled();
      // WsException returned with promise in service
      await expect(mockRecipient).rejects.toThrow(WsException);
    });
  });
});
