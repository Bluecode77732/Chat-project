import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiRoomEntity } from './entities/ai-room.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AiPersonality } from './enums/ai-personality.enum';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class AiRoomService {
  constructor(
    @InjectRepository(AiRoomEntity)
    private readonly aiRoomRepository: Repository<AiRoomEntity>,
  ) {}

  async setPersonality(
    roomId: number,
    personality: AiPersonality,
  ): Promise<void> {
    const existing = await this.aiRoomRepository.findOne({
      where: { room: { id: roomId } },
    });
    if (existing) {
      existing.personality = personality;
      await this.aiRoomRepository.save(existing);
    } else {
      await this.aiRoomRepository.save({
        room: { id: roomId },
        personality,
      });
    }
    logger.info(`Room ${roomId} AI personality set to ${personality}`);
  }

  async getPersonality(roomId: number): Promise<AiPersonality | null> {
    const aiRoom = await this.aiRoomRepository.findOne({
      where: { room: { id: roomId } },
    });
    return aiRoom?.personality ?? null;
  }

  async getPersonalityInfo(
    roomId: number,
  ): Promise<{ personality: AiPersonality | null; canChange: boolean }> {
    const aiRoom = await this.aiRoomRepository.findOne({
      where: { room: { id: roomId } },
    });
    return {
      personality: aiRoom?.personality ?? null,
      canChange: true,
    };
  }
}
