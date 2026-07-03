import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApiError, GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
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
const AI_REPLY_MAX_ATTEMPTS = 3;
const AI_REPLY_BASE_DELAY_MS = 300;
const AI_REPLY_FAILURE_MESSAGE =
  '지금은 답장을 드릴 수 없어요. 잠시 후 다시 시도해주세요.';

export type AiReplyCallbacks = {
  publishFn: (msg: ChatEntity) => Promise<void>;
};

// Gemini content format
type GeminiContent = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

type GenerateContentParams = Parameters<
  GoogleGenAI['models']['generateContent']
>[0];
type GenerateContentResult = Awaited<
  ReturnType<GoogleGenAI['models']['generateContent']>
>;

@Injectable()
export class AiService implements OnModuleInit {
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
    private readonly redis: Redis,

    @Inject('GENAI_CLIENT')
    private readonly genai: GoogleGenAI,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedAiUser();
  }

  private async seedAiUser(): Promise<void> {
    let aiUser = await this.userRepository.findOne({
      where: { email: AI_USER_EMAIL },
    });
    if (!aiUser) {
      const hashedPassword = await bcrypt.hash(
        'NO_LOGIN_SYSTEM_ACCOUNT',
        this.configService.getOrThrow<number>('HASH_ROUNDS'),
      );
      try {
        await this.userRepository.save({
          email: AI_USER_EMAIL,
          password: hashedPassword,
          role: UserRole.user,
          isAI: true,
        });
      } catch {
        // Race condition on multi-instance startup — another instance already created it
      }
      aiUser = await this.userRepository.findOneByOrFail({
        email: AI_USER_EMAIL,
      });
    }
    this.aiUser = aiUser;
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
    const acquired = await this.redis.set(
      lockKey,
      '1',
      'EX',
      AI_LOCK_TTL_SECONDS,
      'NX',
    );

    if (!acquired) {
      logger.debug(`AI lock held for room ${roomId}, skipping.`);
      return;
    }

    try {
      const personality =
        aiPersonality ?? (await this.aiRoomService.getPersonality(roomId));

      if (!personality) {
        logger.debug(`No AI personality set for room ${roomId}, skipping.`);
        return;
      }

      const history = await this.buildHistory(roomId);
      const systemPrompt = SYSTEM_PROMPTS[personality];

      let replyText: string;
      let isFallbackReply = false;
      try {
        const response = await this.generateWithRetry({
          model: GEMINI_MODEL,
          contents: history,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 300,
          },
        });
        replyText = response.text ?? '';
      } catch (error) {
        logger.error(
          `AI reply generation failed for room ${roomId} after retries: ${(error as Error).message}`,
        );
        replyText = AI_REPLY_FAILURE_MESSAGE;
        isFallbackReply = true;
      }

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
      await callbacks.publishFn(serialized);

      logger.info(
        isFallbackReply
          ? `Sent AI failure notice in room ${roomId}, message id=${savedMessage.id}`
          : `AI replied in room ${roomId}, message id=${savedMessage.id}`,
      );
    } catch (error) {
      logger.error(
        `AI reply failed for room ${roomId}: ${(error as Error).message}\n${(error as Error).stack ?? ''}`,
      );
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private isRetryableGeminiError(error: unknown): boolean {
    return (
      error instanceof ApiError && (error.status === 429 || error.status >= 500)
    );
  }

  private async generateWithRetry(
    params: GenerateContentParams,
  ): Promise<GenerateContentResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt < AI_REPLY_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.genai.models.generateContent(params);
      } catch (error) {
        lastError = error;
        if (!this.isRetryableGeminiError(error)) break;
        if (attempt < AI_REPLY_MAX_ATTEMPTS - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, AI_REPLY_BASE_DELAY_MS * 3 ** attempt),
          );
        }
      }
    }
    throw lastError;
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
