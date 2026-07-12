import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
// In: needed for the batch WHERE room_id IN (...) query in getPersonalitiesByRoomIds.
import { In, Repository } from 'typeorm';
import { AiRoomEntity } from './entities/ai-room.entity';
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

  // Batch-fetches personalities for multiple rooms in a single IN query.
  // Used by getAllRooms resolver to enrich AdminRoomType without N+1 per row.
  async getPersonalitiesByRoomIds(
    roomIds: number[],
  ): Promise<Map<number, AiPersonality>> {
    if (roomIds.length === 0) return new Map();
    const aiRooms = await this.aiRoomRepository.find({
      where: { room: { id: In(roomIds) } },
      relations: ['room'],
    });
    const result = new Map<number, AiPersonality>();
    for (const aiRoom of aiRooms) {
      if (aiRoom.room?.id !== undefined) {
        result.set(aiRoom.room.id, aiRoom.personality);
      }
    }
    return result;
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
