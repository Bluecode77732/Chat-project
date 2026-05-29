import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiRoomService } from './ai-room.service';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AiPersonality } from './enums/ai-personality.enum';

jest.mock('src/base/logger/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

describe('AiRoomService', () => {
  let aiRoomService: AiRoomService;

  const mockRoomRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRoomService,
        {
          provide: getRepositoryToken(RoomEntity),
          useValue: mockRoomRepository,
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
    it('should throw NotFoundException when room does not exist', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);

      await expect(
        aiRoomService.setPersonality(1, 1, AiPersonality.FRIENDLY, true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user is not a participant', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 1,
        participants: [{ id: 2 }, { id: 3 }],
      });

      await expect(
        aiRoomService.setPersonality(1, 99, AiPersonality.FRIENDLY, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when personality was already changed once and isInitial is false', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 1,
        participants: [{ id: 1 }],
        aiPersonalityChangedOnce: true,
      });

      await expect(
        aiRoomService.setPersonality(1, 1, AiPersonality.CODING, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set personality without marking changedOnce when isInitial is true', async () => {
      const room = {
        id: 1,
        participants: [{ id: 1 }],
        aiPersonalityChangedOnce: false,
        aiPersonality: null as AiPersonality | null,
      };
      mockRoomRepository.findOne.mockResolvedValue(room);
      mockRoomRepository.save.mockResolvedValue(room);

      await aiRoomService.setPersonality(1, 1, AiPersonality.FRIENDLY, true);

      expect(room.aiPersonality).toBe(AiPersonality.FRIENDLY);
      expect(room.aiPersonalityChangedOnce).toBe(false);
      expect(mockRoomRepository.save).toHaveBeenCalledWith(room);
    });

    it('should set personality and mark changedOnce when isInitial is false', async () => {
      const room = {
        id: 1,
        participants: [{ id: 1 }],
        aiPersonalityChangedOnce: false,
        aiPersonality: AiPersonality.FRIENDLY,
      };
      mockRoomRepository.findOne.mockResolvedValue(room);
      mockRoomRepository.save.mockResolvedValue(room);

      await aiRoomService.setPersonality(1, 1, AiPersonality.CODING, false);

      expect(room.aiPersonality).toBe(AiPersonality.CODING);
      expect(room.aiPersonalityChangedOnce).toBe(true);
      expect(mockRoomRepository.save).toHaveBeenCalledWith(room);
    });
  });

  describe('getPersonality', () => {
    it('should return the AI personality when room exists', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 1,
        aiPersonality: AiPersonality.CODING,
      });

      const result = await aiRoomService.getPersonality(1);

      expect(result).toBe(AiPersonality.CODING);
    });

    it('should return null when room does not exist', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);

      const result = await aiRoomService.getPersonality(1);

      expect(result).toBeNull();
    });

    it('should return null when room has no personality set', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 1,
        aiPersonality: null,
      });

      const result = await aiRoomService.getPersonality(1);

      expect(result).toBeNull();
    });
  });

  describe('getPersonalityInfo', () => {
    it('should return personality and canChange=true when never changed', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 1,
        aiPersonality: AiPersonality.FRIENDLY,
        aiPersonalityChangedOnce: false,
      });

      const result = await aiRoomService.getPersonalityInfo(1);

      expect(result).toEqual({
        personality: AiPersonality.FRIENDLY,
        canChange: true,
      });
    });

    it('should return canChange=false when personality was already changed', async () => {
      mockRoomRepository.findOne.mockResolvedValue({
        id: 1,
        aiPersonality: AiPersonality.CODING,
        aiPersonalityChangedOnce: true,
      });

      const result = await aiRoomService.getPersonalityInfo(1);

      expect(result).toEqual({
        personality: AiPersonality.CODING,
        canChange: false,
      });
    });

    it('should return null personality and canChange=true when room does not exist', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);

      const result = await aiRoomService.getPersonalityInfo(1);

      expect(result).toEqual({ personality: null, canChange: true });
    });
  });
});
