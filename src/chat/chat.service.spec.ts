import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomEntity } from './entities/room.entity';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';
import { CreateChatDto } from './entities/dto/create-chat.dto';

// const mockUserEntity: UserEntity = {
//   id: 1,
//   email: "test@gmail.com",
//   password: "Test123Password",
//   role: 0,     //Signed In
//   chats: [],
//   rooms: [],
// };
const mockUserRepository = {
  findOneBy: jest.fn(),
  findOneByOrFail: jest.fn(),
};

const mockRoomRepository: RoomEntity = {
  id: 1,
  participants: [],
  chats: [],
};

let mockSocket: Partial<Socket>;

describe('ChatService', () => {
  let chatService: ChatService;
  let userRepository: Repository<UserEntity>;
  let roomRepository: Repository<RoomEntity>;
  let dataSource: DataSource;
  mockSocket = {
    id: '1',
    join: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: mockRoomRepository,
        },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
    userRepository = module.get<Repository<UserEntity>>(UserEntity);
    roomRepository = module.get<Repository<RoomEntity>>(RoomEntity);
    dataSource = module.get<DataSource>(DataSource);
  });


  // Clear each mocks after testing execution
  afterEach(() => {
    jest.clearAllMocks();
  })

  const mockRooms = [
    {
      id: 1,
      participants: 1,
      chats: 1
    },
    {
      id: 2,
      participants: 2,
      chats: 2
    },
  ];

  describe("joinRooms", () => {
    it("should join rooms altogether", async () => {
      const mockUser = { sub: 1 };

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockRooms),
      };

      jest.spyOn(roomRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as Object as any);

      const result = await chatService.joinRooms(mockUser, mockSocket as Object as any);

      expect(mockSocket.join).toHaveBeenCalledWith('1');
      expect(mockSocket.join).toHaveBeenCalledWith('2');
      expect(mockSocket.join).toHaveBeenCalledTimes(2);
      expect(result).toEqual([Object, Object]);
    });
  });

  // } as Partial<EntityManager>;

  describe("findRoom", () => {

    it("should return null if a room does not exist", async () => {
      const result = await chatService.findRoom(1, null!, {} as EntityManager);

      expect(result).toBeNull();
    });

    it("should find a room", async () => {
      const mockManager = {
        createQueryBuilder: jest.fn(),
        create: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      } as any;
      const result = await chatService.findRoom(1, 2, {} as EntityManager);

      expect(result).toEqual(mockRooms);
      expect(mockManager.where).toHaveBeenCalledWith({ id1: [0] });
      // expect(mockManager.createQueryBuilder(RoomEntity, "room").where()).toHaveBeenCalledWith({ id1: [0] });
      expect(mockManager.andWhere).toHaveBeenCalledWith({ id2: [1] });
    });
  });


  describe("createRoom", () => {

    it("should create a room", async () => {
      const user1 = { id: 1, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const user2 = { id: 2, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      // const room = { id: 1, participants: [1, 2] };
      const mockManager = {
        createQueryBuilder: jest.fn(),
        create: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      } as any;

      const room = await mockManager.create(RoomEntity, { participants: [user1, user2], });
      const result = await mockManager.save(room);

      // const result = await chatService.createRoom(user1, user2, mockManager);

      expect(result).toEqual(mockRooms);
      expect(mockManager.create).toHaveBeenCalledWith(RoomEntity, { participants: [user1, user2] });
      expect(mockManager.save).toHaveBeenCalledWith(mockRooms);
    });

    it("should throw WebSocket exception if the room id does not exist", async () => {
      const user1 = { id: 1, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const user2 = { id: 2, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const mockManager = {
        createQueryBuilder: jest.fn(),
        create: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      } as any;
      const result = await chatService.createRoom(user1, user2, {} as EntityManager);

      expect(mockManager.where).toHaveBeenCalledWith({ id2: [1] });
      await expect(result).rejects.toThrow(WsException);
    });
  });


  describe("getAndCreateRoom", () => {
    it("should get or create a room", async () => {
      const clientConnection = new Map<number, Socket>();
      const sender = { id: 1, email: "email@gmail.com", password: "pw", role: 0 } as UserEntity;
      const recipientId = 2;

      const mockManager = {
        createQueryBuilder: jest.fn(),
        create: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      } as any;

      const mockQueryRunner = {
        mockManager,
      } as any;

      let room = await chatService.findRoom(1, 2, mockQueryRunner);
      const recipient = await userRepository.findOneBy({
        id: recipientId,
      }) as UserEntity;

      jest.spyOn(chatService as ChatService, 'findRoom').mockResolvedValue(room);
      jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(recipient);

      room = await chatService.createRoom(sender, recipient, mockManager);

      const result = [sender.id, recipient.id].forEach((id) => {
        const connect = clientConnection.get(id);

        connect?.emit("CreateRoom", room.id.toString());
        connect?.join(room.id.toString());
      });

      expect(room).toHaveBeenCalledWith();
      expect(result).toEqual(mockRooms);
    });

    it("should return room if there's existing one", async () => {
      const mockManager = {
        createQueryBuilder: jest.fn(),
        create: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      } as any;

      let room = await chatService.findRoom(1, 2, mockManager);

      expect(room).toEqual(mockRooms);
    });

    it("should throw WebSocket exception if recipient does not exist", async () => {
      const recipientId = 2;
      const recipient = await userRepository.findOneBy({
        id: recipientId,
      });

      expect(recipient).rejects.toThrow(WsException);
    });

    it("should throw null if connect to socket", async () => {
      const clientConnection = new Map<number, Socket>();
      expect(clientConnection).toBeNull();
    });

    it("should throw WebSocket exception if connect to socket", async () => {
      const sender = { id: 1, email: "user1@gmail.com", password: "pw", role: 0 } as UserEntity;
      const recipientId = 2;
      const mockManager = {
        createQueryBuilder: jest.fn(),
        create: jest.fn(),
        innerJoin: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getOne: jest.fn(),
      } as any;

      let room = await chatService.findRoom(1, 2, mockManager);

      const recipient = await userRepository.findOneBy({
        id: recipientId,
      }) as UserEntity;

      room = await chatService.createRoom(sender, recipient, mockManager);

      expect(room?.id).rejects.toThrow(WsException);
    });
  });


  describe("sendMessage", () => {
    it("should send message successfully", async () => {
      const payload = { sub: 1};
      const createChatDto : CreateChatDto = { message: "", recipientId: 1 };
      const sender = {}



    });
  });



});
