import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '@google/genai';
import { AiService, AiReplyCallbacks } from './ai.service';
import { AiRoomService } from './ai-room.service';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AiPersonality } from './enums/ai-personality.enum';

jest.mock('src/base/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGenai = {
  models: { generateContent: jest.fn() },
};

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
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
        {
          provide: 'GENAI_CLIENT',
          useValue: mockGenai,
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      (aiService as { aiUser: UserEntity | undefined }).aiUser = undefined;

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
    const AI_REPLY_FAILURE_MESSAGE =
      '지금은 답장을 드릴 수 없어요. 잠시 후 다시 시도해주세요.';

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
        publishFn: jest.fn().mockResolvedValue(undefined),
      };
      mockRedis.set.mockResolvedValue('OK');
    });

    it('should return early when Redis lock cannot be acquired', async () => {
      mockRedis.set.mockResolvedValue(null);

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(callbacks.publishFn).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return early and release lock when no personality is set', async () => {
      mockAiRoomService.getPersonality.mockResolvedValue(null);
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );

      await aiService.handleReply(roomId, null, callbacks);

      expect(callbacks.publishFn).not.toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
    });

    it('should use provided personality and not call aiRoomService', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai.models.generateContent.mockResolvedValue({
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
      expect(callbacks.publishFn).toHaveBeenCalled();
    });

    it('should fetch personality from aiRoomService when not provided', async () => {
      mockAiRoomService.getPersonality.mockResolvedValue(AiPersonality.CODING);
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai.models.generateContent.mockResolvedValue({
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
      (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai.models.generateContent.mockResolvedValue({
        text: '',
      });

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(callbacks.publishFn).not.toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
    });

    it('should save message and invoke both callbacks on success', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai.models.generateContent.mockResolvedValue({
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

      expect(callbacks.publishFn).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10 }),
      );
    });

    it('should send a fallback notice and release the lock when Gemini throws', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai.models.generateContent.mockRejectedValue(
        new Error('Gemini API error'),
      );
      mockRoomRepository.findOneByOrFail.mockResolvedValue(mockRoom);
      const createSpy = jest.fn().mockReturnValue(mockSavedMsg);
      mockDataSource.transaction.mockImplementation(
        async (cb: (m: any) => Promise<ChatEntity>) => {
          const manager = {
            create: createSpy,
            save: jest.fn().mockResolvedValue(mockSavedMsg),
          };
          return cb(manager);
        },
      );

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
      expect(createSpy).toHaveBeenCalledWith(
        ChatEntity,
        expect.objectContaining({ message: AI_REPLY_FAILURE_MESSAGE }),
      );
      expect(callbacks.publishFn).toHaveBeenCalledWith(
        expect.objectContaining({ id: 10 }),
      );
    });

    it('should retry and succeed after a retryable Gemini error (429)', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      const genaiMock = (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai;
      genaiMock.models.generateContent
        .mockRejectedValueOnce(
          new ApiError({ message: 'rate limited', status: 429 }),
        )
        .mockResolvedValueOnce({ text: 'Recovered reply' });
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

      expect(genaiMock.models.generateContent).toHaveBeenCalledTimes(2);
      expect(callbacks.publishFn).toHaveBeenCalled();
    }, 10000);

    it('should not retry a non-retryable Gemini error (400) and send a fallback notice', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      const genaiMock = (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai;
      genaiMock.models.generateContent.mockRejectedValue(
        new ApiError({ message: 'bad request', status: 400 }),
      );
      mockRoomRepository.findOneByOrFail.mockResolvedValue(mockRoom);
      const createSpy = jest.fn().mockReturnValue(mockSavedMsg);
      mockDataSource.transaction.mockImplementation(
        async (cb: (m: any) => Promise<ChatEntity>) => {
          const manager = {
            create: createSpy,
            save: jest.fn().mockResolvedValue(mockSavedMsg),
          };
          return cb(manager);
        },
      );

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(genaiMock.models.generateContent).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(
        ChatEntity,
        expect.objectContaining({ message: AI_REPLY_FAILURE_MESSAGE }),
      );
      expect(callbacks.publishFn).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
    });

    it('should exhaust retries after repeated 500 errors and send a fallback notice', async () => {
      mockChatRepository.createQueryBuilder.mockReturnValue(
        buildMockQueryBuilder(),
      );
      const genaiMock = (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai;
      genaiMock.models.generateContent.mockRejectedValue(
        new ApiError({ message: 'server error', status: 500 }),
      );
      mockRoomRepository.findOneByOrFail.mockResolvedValue(mockRoom);
      const createSpy = jest.fn().mockReturnValue(mockSavedMsg);
      mockDataSource.transaction.mockImplementation(
        async (cb: (m: any) => Promise<ChatEntity>) => {
          const manager = {
            create: createSpy,
            save: jest.fn().mockResolvedValue(mockSavedMsg),
          };
          return cb(manager);
        },
      );

      await aiService.handleReply(roomId, AiPersonality.FRIENDLY, callbacks);

      expect(genaiMock.models.generateContent).toHaveBeenCalledTimes(3);
      expect(createSpy).toHaveBeenCalledWith(
        ChatEntity,
        expect.objectContaining({ message: AI_REPLY_FAILURE_MESSAGE }),
      );
      expect(callbacks.publishFn).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(`ai:lock:${roomId}`);
    }, 10000);

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
      (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai.models.generateContent.mockResolvedValue({
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

      type GenContent = { contents: Array<{ role: string }> };
      const genaiMock = (
        aiService as unknown as {
          genai: { models: { generateContent: jest.Mock } };
        }
      ).genai;
      const generateContentCall = (
        genaiMock.models.generateContent.mock.calls as GenContent[][]
      )[0][0];
      expect(generateContentCall.contents[0].role).toBe('model');
      expect(generateContentCall.contents[1].role).toBe('user');
    });
  });
});
