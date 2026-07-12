import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiRoomService } from './ai-room.service';
import { AiRoomEntity } from './entities/ai-room.entity';
import { AiPersonality } from './enums/ai-personality.enum';

jest.mock('src/base/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('AiRoomService', () => {
  let aiRoomService: AiRoomService;

  const mockAiRoomRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRoomService,
        {
          provide: getRepositoryToken(AiRoomEntity),
          useValue: mockAiRoomRepository,
        },
      ],
    }).compile();

    aiRoomService = module.get<AiRoomService>(AiRoomService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(aiRoomService).toBeDefined();
  });

  describe('setPersonality', () => {
    it('should create new AiRoomEntity when none exists', async () => {
      mockAiRoomRepository.findOne.mockResolvedValue(null);
      mockAiRoomRepository.save.mockResolvedValue({});

      await aiRoomService.setPersonality(1, AiPersonality.FRIENDLY);

      expect(mockAiRoomRepository.save).toHaveBeenCalledWith({
        room: { id: 1 },
        personality: AiPersonality.FRIENDLY,
      });
    });

    it('should update existing personality', async () => {
      const existing = { id: 1, personality: AiPersonality.FRIENDLY };
      mockAiRoomRepository.findOne.mockResolvedValue(existing);
      mockAiRoomRepository.save.mockResolvedValue(existing);

      await aiRoomService.setPersonality(1, AiPersonality.CODING);

      expect(existing.personality).toBe(AiPersonality.CODING);
      expect(mockAiRoomRepository.save).toHaveBeenCalledWith(existing);
    });
  });

  describe('getPersonality', () => {
    it('should return the AI personality when AiRoomEntity exists', async () => {
      mockAiRoomRepository.findOne.mockResolvedValue({
        id: 1,
        personality: AiPersonality.CODING,
      });

      const result = await aiRoomService.getPersonality(1);

      expect(result).toBe(AiPersonality.CODING);
    });

    it('should return null when no AiRoomEntity exists for room', async () => {
      mockAiRoomRepository.findOne.mockResolvedValue(null);

      const result = await aiRoomService.getPersonality(1);

      expect(result).toBeNull();
    });
  });

  describe('getPersonalitiesByRoomIds', () => {
    // Returns an empty Map immediately — no DB call needed for an empty input list.
    it('returns an empty map when roomIds is empty.', async () => {
      const result = await aiRoomService.getPersonalitiesByRoomIds([]);
      expect(mockAiRoomRepository.find).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });

    // One IN query covers all roomIds; only rooms with an AiRoomEntity appear in the map.
    it('returns a map of roomId → personality for matched rooms.', async () => {
      mockAiRoomRepository.find.mockResolvedValue([
        { personality: AiPersonality.FRIENDLY, room: { id: 1 } },
        { personality: AiPersonality.CODING, room: { id: 3 } },
      ]);

      const result = await aiRoomService.getPersonalitiesByRoomIds([1, 2, 3]);

      expect(mockAiRoomRepository.find).toHaveBeenCalledTimes(1);
      expect(result.get(1)).toBe(AiPersonality.FRIENDLY);
      expect(result.get(3)).toBe(AiPersonality.CODING);
      expect(result.has(2)).toBe(false);
    });
  });

  describe('getPersonalityInfo', () => {
    it('should return personality and canChange=true', async () => {
      mockAiRoomRepository.findOne.mockResolvedValue({
        id: 1,
        personality: AiPersonality.FRIENDLY,
      });

      const result = await aiRoomService.getPersonalityInfo(1);

      expect(result).toEqual({
        personality: AiPersonality.FRIENDLY,
        canChange: true,
      });
    });

    it('should return null personality and canChange=true when no AiRoomEntity exists', async () => {
      mockAiRoomRepository.findOne.mockResolvedValue(null);

      const result = await aiRoomService.getPersonalityInfo(1);

      expect(result).toEqual({ personality: null, canChange: true });
    });
  });
});
