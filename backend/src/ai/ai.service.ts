import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import * as RedisClient from 'redis';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { UserRole } from 'src/auth/role/role';
import { AiPersonality } from './enums/ai-personality.enum';
import { AiRoomService } from './ai-room.service';
import { AI_USER_EMAIL, SYSTEM_PROMPTS } from './constants/system-prompts';
import { logger } from 'src/base/logger/logger';
import { plainToClass } from 'class-transformer';
import { SessionCacheService } from 'src/redis/redis.service';

const AI_LOCK_TTL_SECONDS = 30;
const AI_HISTORY_LIMIT = 10;
const GEMINI_MODEL = 'gemini-2.5-flash';

export type AiReplyCallbacks = {
  broadcastFn: (msg: ChatEntity) => void;
  publishFn: (msg: ChatEntity) => Promise<void>;
};

// Gemini content format
type GeminiContent = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

@Injectable()
export class AiService implements OnModuleInit {
  private genai: GoogleGenAI;
  private aiUser!: UserEntity;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(ChatEntity)
    private readonly chatRepository: Repository<ChatEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,

    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly aiRoomService: AiRoomService,
    private readonly sessionCacheService: SessionCacheService,

    @Inject('REDIS_CLIENT')
    private readonly redis: RedisClient.RedisClientType,
  ) {
    this.genai = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.seedAiUser();
  }

  private async seedAiUser(): Promise<void> {
    // UPSERT: safe for multi-instance startup
    await this.userRepository.upsert(
      {
        email: AI_USER_EMAIL,
        password: 'NO_LOGIN_SYSTEM_ACCOUNT',
        role: UserRole.signedIn,
        isAI: true,
      },
      { conflictPaths: ['email'], skipUpdateIfNoValuesChanged: true },
    );
    this.aiUser = await this.userRepository.findOneByOrFail({
      email: AI_USER_EMAIL,
    });
    logger.info(`AI user ready: id=${this.aiUser.id}`);
  }

  getAiUserId(): number {
    if (!this.aiUser?.id) {
      throw new BadRequestException('AI user not initialized.');
    }
    return this.aiUser.id;
  }

  async handleReply(
    roomId: number,
    aiPersonality: AiPersonality | undefined | null,
    callbacks: AiReplyCallbacks,
  ): Promise<void> {
    const lockKey = `ai:lock:${roomId}`;
    const acquired = await this.redis.set(lockKey, '1', {
      NX: true,
      EX: AI_LOCK_TTL_SECONDS,
    });

    if (!acquired) {
      logger.info(`AI lock held for room ${roomId}, skipping.`);
      return;
    }

    try {
      const personality =
        aiPersonality ?? (await this.aiRoomService.getPersonality(roomId));

      if (!personality) {
        logger.info(`No AI personality set for room ${roomId}, skipping.`);
        return;
      }

      const history = await this.buildHistory(roomId);
      const systemPrompt = SYSTEM_PROMPTS[personality];

      const response = await this.genai.models.generateContent({
        model: GEMINI_MODEL,
        contents: history,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 300,
        },
      });

      const replyText = response.text ?? '';

      if (!replyText) return;

      const room = await this.roomRepository.findOneByOrFail({ id: roomId });
      const savedMessage = await this.dataSource.transaction(
        async (manager) => {
          const msg = manager.create(ChatEntity, {
            message: replyText,
            participant: this.aiUser,
            room,
          });
          return manager.save(ChatEntity, msg);
        },
      );

      const msgWithRelations = Object.assign(savedMessage, {
        participant: this.aiUser,
        room,
      });

      await this.sessionCacheService.cacheMessage(roomId, msgWithRelations);

      const serialized = plainToClass(ChatEntity, msgWithRelations);
      callbacks.broadcastFn(serialized);
      await callbacks.publishFn(serialized);

      logger.info(
        `AI replied in room ${roomId}, message id=${savedMessage.id}`,
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`AI reply failed for room ${roomId}: ${msg}`);
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async buildHistory(roomId: number): Promise<GeminiContent[]> {
    const messages = await this.chatRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.participant', 'participant')
      .where('chat.room = :roomId', { roomId })
      .orderBy('chat.id', 'DESC')
      .take(AI_HISTORY_LIMIT)
      .getMany();

    return messages.reverse().map(
      (m): GeminiContent => ({
        // Gemini uses 'model' for AI responses, not 'assistant'
        role: m.participant?.isAI ? 'model' : 'user',
        parts: [{ text: m.message ?? '' }],
      }),
    );
  }
}
