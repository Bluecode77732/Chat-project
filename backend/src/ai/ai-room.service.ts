import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AiPersonality } from './enums/ai-personality.enum';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class AiRoomService {
  constructor(
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,
  ) {}

  async setPersonality(
    roomId: number,
    userId: number,
    personality: AiPersonality,
    isInitial: boolean,
  ): Promise<void> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['participants'],
    });

    if (!room) throw new NotFoundException('Room not found.');

    const isMember = room.participants?.some((p) => p.id === userId);
    if (!isMember) throw new BadRequestException('Not a room participant.');

    if (!isInitial && room.aiPersonalityChangedOnce) {
      throw new BadRequestException('AI personality can only be changed once.');
    }

    room.aiPersonality = personality;
    if (!isInitial) {
      room.aiPersonalityChangedOnce = true;
    }

    await this.roomRepository.save(room);
    logger.info(`Room ${roomId} AI personality set to ${personality}`);
  }

  async getPersonality(roomId: number): Promise<AiPersonality | null> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    return room?.aiPersonality ?? null;
  }

  async getPersonalityInfo(
    roomId: number,
  ): Promise<{ personality: AiPersonality | null; canChange: boolean }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    return {
      personality: room?.aiPersonality ?? null,
      canChange: !(room?.aiPersonalityChangedOnce ?? false),
    };
  }
}
