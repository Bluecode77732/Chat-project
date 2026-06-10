import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiService, AiReplyCallbacks } from './ai.service';
import { AiRoomService } from './ai-room.service';
import { SessionCacheService } from 'src/redis/redis.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AiPersonality } from './enums/ai-personality.enum';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
    },
  })),
}));

jest.mock('src/base/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AiService', () => {
  let aiService: AiService;

  const mockAiUser: UserEntity = {
    id: 99,
    email: 'ai@system.local',
    isAI: true,
  };

  const mockUserRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    findOneByOrFail: jest.fn().mockResolvedValue(mockAiUser),
    save: jest.fn().mockResolvedValue(mockAiUser),
  };

  const mockChatRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockRoomRepository = {
    findOneByOrFail: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue('test-api-key'),
  };

  const mockAiRoomService = {
    getPersonality: jest.fn(),
  };

  const mockSessionCacheService = {
    cacheMessage: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedis = {
    set: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(ChatEntity),
          useValue: mockChatRepository,
        },
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: mockRoomRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AiRoomService,
          useValue: mockAiRoomService,
        },
        {
          provide: SessionCacheService,
          useValue: mockSessionCacheService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    aiService = module.get<AiService>(AiService);
    await aiService.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(aiService).toBeDefined();
  });

  describe('onModuleInit / seedAiUser', () => {
    it('should create the AI account with hashed password when it does not exist', () => {
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ai@system.local',
          isAI: true,
          role: expect.any(Number),
        }),
      );
    });

    it('should store the AI user after creation', () => {
      expect(mockUserRepository.findOneByOrFail).toHaveBeenCalledWith({
        email: 'ai@system.local',
      });
      expect(aiService.getAiUserId()).toBe(99);
    });

    it('should skip creation and reuse existing AI user when already in DB', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(mockAiUser);
      mockUserRepository.save.mockClear();

      await aiService.onModuleInit();

      expect(mockUserRepository.save).not.toHaveBeenCalled();
      expect(aiService.getAiUserId()).toBe(99);
    });
  });

  describe('getAiUserId', () => {
    it('should return the AI user id after initialization', () => {
      expect(aiService.getAiUserId()).toBe(99);
    });

    it('should throw BadRequestException when AI user is not initialized', () => {
      (aiService as any).aiUser = undefined;

      expect(() => aiService.getAiUserId()).toThrow(BadRequestException);
    });
  });

  describe('handleReply', () => {
    const roomId = 1;
    const mockRoom: RoomEntity = { id: roomId };
    const mockSavedMsg: ChatEntity = {
      id: 10,
      message: 'AI reply text',
    };

    let callbacks: AiReplyCallbacks;

    const buildMockQueryBuilder = (messages: ChatEntity[] = []) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(messages),
    });

    beforeEach(() => {
      callbacks = {
        broadcastFn: jest.fn(),
        publishFn: jest.fn().mockResolvedValue(undefined),
      };
      mockRedis.set.mockResolvedValue('OK');
    });

    it('should return early when Redis lock cannot be acquired', async () => {
      mockRedis.set.mockResolvedValue(null);

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(callbacks.broadcastFn).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return early and release lock when no personality is set', async () => {
      mockAiRoomService.getPersonality.mockResolvedValue(null);
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );

      await aiService.handleReply(roomId, null, callbacks);

      expect(callbacks.broadcastFn).not.toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
    });

    it('should use provided personality and not call aiRoomService', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (aiService as any).genai.models.generateContent.mockResolvedValue({
        text: 'AI reply text',
      });
      mockRoomRepository.findOneByOrFail.mockResolvedValue(mockRoom);
      mockDataSource.transaction.mockImplementation(
        async (cb: (m: any) => Promise<ChatEntity>) => {
          const manager = {
            create: jest.fn().mockReturnValue(mockSavedMsg),
            save: jest.fn().mockResolvedValue(mockSavedMsg),
          };
          return cb(manager);
        },
      );

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(mockAiRoomService.getPersonality).not.toHaveBeenCalled();
      expect(callbacks.broadcastFn).toHaveBeenCalled();
    });

    it('should fetch personality from aiRoomService when not provided', async () => {
      mockAiRoomService.getPersonality.mockResolvedValue(AiPersonality.CODING);
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (aiService as any).genai.models.generateContent.mockResolvedValue({
        text: 'Code answer',
      });
      mockRoomRepository.findOneByOrFail.mockResolvedValue(mockRoom);
      mockDataSource.transaction.mockImplementation(
        async (cb: (m: any) => Promise<ChatEntity>) => {
          const manager = {
            create: jest.fn().mockReturnValue(mockSavedMsg),
            save: jest.fn().mockResolvedValue(mockSavedMsg),
          };
          return cb(manager);
        },
      );

      await aiService.handleReply(roomId, null, callbacks);

      expect(mockAiRoomService.getPersonality).toHaveBeenCalledWith(roomId);
    });

    it('should skip saving and release lock when Gemini returns empty text', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (aiService as any).genai.models.generateContent.mockResolvedValue({
        text: '',
      });

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(callbacks.broadcastFn).not.toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
    });

    it('should save message and invoke both callbacks on success', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (aiService as any).genai.models.generateContent.mockResolvedValue({
        text: 'AI reply text',
      });
      mockRoomRepository.findOneByOrFail.mockResolvedValue(mockRoom);
      mockDataSource.transaction.mockImplementation(
        async (cb: (m: any) => Promise<ChatEntity>) => {
          const manager = {
            create: jest.fn().mockReturnValue(mockSavedMsg),
            save: jest.fn().mockResolvedValue(mockSavedMsg),
          };
          return cb(manager);
        },
      );

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(callbacks.broadcastFn).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10 }),
      );
      expect(callbacks.publishFn).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10 }),
      );
    });

    it('should always release the Redis lock even when Gemini throws', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (aiService as any).genai.models.generateContent.mockRejectedValue(
        new Error('Gemini API error'),
      );

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
      expect(callbacks.broadcastFn).not.toHaveBeenCalled();
    });

    it('should build history with correct role mapping for AI and user messages', async () => {
      const aiMessage = {
        id: 1,
        message: 'I am AI',
        participant: { id: 99, isAI: true },
      } as ChatEntity;
      const userMsg = {
        id: 2,
        message: 'Hello',
        participant: { id: 1, isAI: false },
      } as ChatEntity;

      // buildHistory orders DESC then reverses, so mock returns newest-first
      const qb = buildMockQueryBuilder([userMsg, aiMessage]);
      mockChatRepository.createQueryBuilder.mockReturnValue(qb);
      (aiService as any).genai.models.generateContent.mockResolvedValue({
        text: 'Response',
      });
      mockRoomRepository.findOneByOrFail.mockResolvedValue(mockRoom);
      mockDataSource.transaction.mockImplementation(
        async (cb: (m: any) => Promise<ChatEntity>) => {
          const manager = {
            create: jest.fn().mockReturnValue(mockSavedMsg),
            save: jest.fn().mockResolvedValue(mockSavedMsg),
          };
          return cb(manager);
        },
      );

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      const generateContentCall = (aiService as any).genai.models
        .generateContent.mock.calls[0][0];
      expect(generateContentCall.contents[0].role).toBe('model');
      expect(generateContentCall.contents[1].role).toBe('user');
    });
  });
});
