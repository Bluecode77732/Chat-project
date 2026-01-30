import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomEntity } from './entities/room.entity';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { ChatEntity } from './entities/chat.entity';


describe('ChatService', () => {
  let mockSocket: Partial<Socket>;
  let mockQueryRunner: Partial<QueryRunner>;

  let chatService: ChatService;
  let userRepository: Repository<UserEntity>;
  let roomRepository: Repository<RoomEntity>;
  let dataSource: DataSource;


  beforeEach(async () => {
    //* Mock instances
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        create: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    mockSocket = {
      id: '1',
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

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
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    userRepository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    roomRepository = module.get<Repository<RoomEntity>>(getRepositoryToken(RoomEntity));
    dataSource = module.get<DataSource>(DataSource);
  });

  //* Basic service initialization test
  it('should be defined', () => {
    expect(chatService).toBeDefined();
  });

  //* Clear each mocks after testing execution
  afterEach(() => {
    jest.clearAllMocks();
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
      const result = await chatService.findRoom(1, 2, {} as EntityManager);
      const mockRooms = [{ id: 1, participants: 1, chats: 1 }];

      expect(result).toEqual(mockRooms);
      expect(mockManager.where).toHaveBeenCalledWith("participant1.id = :id1", { id1: [0] });
      expect(mockManager.andWhere).toHaveBeenCalledWith("participant2.id = :id2", { id2: [1] });
    });

    it("should return null if a room does not exist", async () => {
      const result = await chatService.findRoom(null!, null!, {} as EntityManager);

      expect(result).toBeNull();
    });
  });


  describe("createRoom", () => {
    it("should create and save a room", async () => {
      const user1 = { id: 1, email: "email@gmail.com", role: 0 } as UserEntity;
      const user2 = { id: 2, email: "email@gmail.com", role: 0 } as UserEntity;
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
      const user1 = { id: 1, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const user2 = { id: 2, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockManager = {
        create: jest.fn(),
        save: jest.fn(),
      };

      const result = await chatService.createRoom(user1, user2, mockManager as any);

      expect(result).rejects.toThrow(WsException);
    });
  });


  describe("getOrCreateRoom", () => {
    it("should get or create a room", async () => {
      //* the mock family
      const mockSender = { id: 1, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockManager = {
        createQueryBuilder: jest.fn(),
        create: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      } as Partial<EntityManager>;

      const recipient = await userRepository.findOneBy({
        id: mockRecipientId,
      }) as UserEntity;

      jest.spyOn(chatService as ChatService, 'findRoom').mockResolvedValue(mockRooms);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(recipient);

      const result = await chatService.findRoom(1, 2, mockManager as EntityManager);

      expect(result).toEqual(mockRooms);
      expect(chatService.findRoom(mockSender.id, mockSender.id, mockManager as EntityManager)).toHaveBeenCalledWith(mockRooms);
    });


    it("should notify successful connection of users joining the rooms", async () => {
      const mockClientConnection = new Map<number, Socket>();
      const mockSender = { id: 1, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockRecipientId = 2;
      const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;
      const mockRecipient = await userRepository.findOneBy({ id: mockRecipientId }) as UserEntity;

      const mockSenderSocket = {} as Socket;
      const mockRecipientSocket = {} as Socket;

      //* [sender.id, recipient.id].forEach((id) => {
      //*    const connect = clientConnection.get(id);
      //* })
      mockClientConnection.set(1, mockSenderSocket as Socket);
      mockClientConnection.set(2, mockRecipientSocket as Socket);

      //* let room = await this.findRoom(sender.id, recipientId, manager);
      //* const recipient = await this.userRepository.findOneBy({
      //* room = await this.createRoom(sender, recipient, manager);
      jest.spyOn(chatService, 'findRoom').mockResolvedValue(mockRooms);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(mockRecipient);
      jest.spyOn(chatService, 'createRoom').mockResolvedValue(mockRooms);

      //* connect?.emit("CreateRoom", room.id.toString());
      //* connect?.join(room.id.toString());

      const result = await chatService.getOrCreateRoom(mockSender, mockRecipientId, mockQueryRunner as QueryRunner);

      //* Notify and connect two of users
      //* "CreateRoom", room.id.toString() 
      //* room.id.toString()
      expect(mockSenderSocket.emit).toHaveBeenCalledWith("CreateRoom", "1");
      expect(mockSenderSocket.join).toHaveBeenCalledWith('1');
      expect(mockRecipientSocket.emit).toHaveBeenCalledWith("CreateRoom", "2");
      expect(mockRecipientSocket.join).toHaveBeenCalledWith('2');
      expect(result).toEqual(mockRooms);
    });


    // it("should return room if there's existing one", async () => {
    //   const mockRooms = [
    //     { id: 1, participants: 1, chats: 1 },
    //   ];

    //   const mockManager = {
    //     createQueryBuilder: jest.fn(),
    //     create: jest.fn(),
    //     innerJoin: jest.fn(),
    //     where: jest.fn(),
    //     andWhere: jest.fn(),
    //     getOne: jest.fn(),
    //   } as any;

    //   let room = await chatService.findRoom(1, 2, mockManager);

    //   expect(room).toEqual(mockRooms);
    // });


    // it("should throw WebSocket exception if recipient does not exist", async () => {
    //   const recipientId = 2;
    //   const recipient = await userRepository.findOneBy({
    //     id: recipientId,
    //   });

    //   expect(recipient).rejects.toThrow(WsException);
    // });


    // it("should throw null if connect to socket", async () => {
    //   const clientConnection = new Map<number, Socket>();
    //   expect(clientConnection).toBeNull();
    // });


    // it("should throw WebSocket exception if connect to socket", async () => {
    //   const sender = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
    //   const recipientId = 2;
    //   const mockManager = {
    //     createQueryBuilder: jest.fn(),
    //     create: jest.fn(),
    //     innerJoin: jest.fn(),
    //     where: jest.fn(),
    //     andWhere: jest.fn(),
    //     getOne: jest.fn(),
    //   } as any;

    //   let room = await chatService.findRoom(1, 2, mockManager);

    //   const recipient = await userRepository.findOneBy({
    //     id: recipientId,
    //   }) as UserEntity;

    //   room = await chatService.createRoom(sender, recipient, mockManager);

    //   expect(room?.id).rejects.toThrow(WsException);
    // });
  });


  describe("sendMessage", () => {
    it("should send message successfully", async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = { message: "", recipientId: 2 };
      const sender = { id: 1 };
      const recipient = { id: 1 };
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
        { id: 2, participants: 2, chats: 2 },
      ];
      const mockMessageSchema = {
        id: 100,
        message: 'a message',
        participant: sender,
        chatRoom: mockRooms,
      };

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(sender as UserEntity);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(recipient as UserEntity);
      jest.spyOn(chatService as ChatService, 'getOrCreateRoom').mockResolvedValue(mockRooms as any);
      // mockQueryRunner.manager.save as EntityManager = jest.fn().mockResolvedValue(mockMessageSchema);
      jest.spyOn(mockQueryRunner.manager as EntityManager, 'save').mockResolvedValue(mockMessageSchema);

      const result = await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(userRepository.findOneByOrFail).toHaveBeenCalledWith({ id: 1 });
      expect(userRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(mockQueryRunner.manager?.save).toHaveBeenCalledWith(ChatEntity, mockMessageSchema);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toEqual(mockMessageSchema);
      expect(result).toBe('a message');
    });

    it("should throw WebSocket exception if sender does not exist then rollback to release", async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = { message: "a message", recipientId: 2 };
      const sender = { id: 1 } as UserEntity;
      const recipientId = { id: 2 } as UserEntity;
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
      ]
      const mockMessageSchema = {
        id: 100,
        message: 'a message',
        participant: sender,
        chatRoom: mockRooms,
      };

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(sender);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(recipientId);

      const result = await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner);
      // await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(sender).rejects.toThrow(WsException);
      expect(result).toEqual(mockMessageSchema);
      expect(result).toBe('a message');
    });

    it("should throw WebSocket exception if recipient does not exist then rollback to release", async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = { message: "a message", recipientId: 2 };
      const sender = { id: 1 } as UserEntity;
      const recipientId = { id: 2 } as UserEntity;
      const recipient = { id: 2 };

      jest.spyOn(userRepository, 'findOneByOrFail').mockResolvedValue(sender);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(recipient as UserEntity);

      await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).rejects.toHaveBeenCalled();
      expect(recipient).rejects.toThrow(WsException);
    });

    it("should throw null if connect to socket", async () => {
      const payload = { sub: 1 };
      const createChatDto: CreateChatDto = { message: "a message", recipientId: 2 };
      const sender = { id: 1 } as UserEntity;
      const recipientId = { id: 2 } as UserEntity;
      const recipient = { id: 2 };
      const mockRooms = [
        { id: 1, participants: 1, chats: 1 },
        { id: 2, participants: 2, chats: 2 },
      ] as any;

      jest.spyOn(chatService as ChatService, 'getOrCreateRoom').mockResolvedValue(mockRooms);

      await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner)

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).rejects.toHaveBeenCalled();
      expect(recipient).rejects.toThrow(WsException);
    });

    // it("should throw WebSocket exception if connect to socket", async () => {
    //   const payload = { sub: 1 };
    //   const createChatDto: CreateChatDto = { message: "a message", recipientId: 2 };
    //   const sender = { id: 1 } as UserEntity;
    //   const recipientId = { id: 2 } as UserEntity;
    //   const recipient = { id: 2 };

    //   let room = await chatService.findRoom(1, 2, mockQueryRunner);

    //   await chatService.sendMessage(payload, createChatDto, mockQueryRunner as QueryRunner)

    //   expect(room?.id).rejects.toThrow(WsException);
    // });
  });
});
