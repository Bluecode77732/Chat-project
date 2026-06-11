import {
  Resolver,
  Subscription,
  Mutation,
  Args,
  Query,
  Context,
  ID,
  Int,
} from '@nestjs/graphql';
import { CreateChatInput } from 'src/graphql/create-chat-input.type';
import { MessageType } from 'src/graphql/message-type.dto';
import { RoomInfoType } from 'src/graphql/room-info.type';
import { AiPersonalityInfoType } from 'src/graphql/ai-personality-info.type';
import { ChatService } from './chat.service';
import {
  ForbiddenException,
  InternalServerErrorException,
  UseGuards,
} from '@nestjs/common';
import { GraphQLAuthGuard } from 'src/auth/guard/graphql.auth.guard';
import { RateLimitGuard } from './guard/rate-limit.guard';
import { PubSubService } from 'src/graphql/pubsub.service';
import { DataSource } from 'typeorm';
import { logger } from 'src/base/logger/logger';
import { SessionCacheService } from 'src/redis/redis.service';
import { AiService } from 'src/ai/ai.service';
import { AiRoomService } from 'src/ai/ai-room.service';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    private readonly pubSub: PubSubService,
    private readonly dataSource: DataSource,
    private readonly sessionCacheService: SessionCacheService,
    private readonly aiService: AiService,
    private readonly aiRoomService: AiRoomService,
  ) {}

  @Query(() => String)
  ping(): string {
    return 'ping has returned.';
  }

  @Query(() => Int)
  getAiUserId(): number {
    return this.aiService.getAiUserId();
  }

  @Query(() => AiPersonalityInfoType, { nullable: true })
  @UseGuards(GraphQLAuthGuard)
  async getAiPersonalityInfo(
    @Context() ctx: any,
    @Args('roomId', { type: () => Int }) roomId: number,
  ): Promise<AiPersonalityInfoType> {
    const userId = ctx.req?.user?.id as number;
    if (!(await this.chatService.isRoomParticipant(userId, roomId))) {
      throw new ForbiddenException('Access denied to this room');
    }
    return this.aiRoomService.getPersonalityInfo(roomId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GraphQLAuthGuard)
  async setAiPersonality(
    @Context() ctx: any,
    @Args('roomId', { type: () => Int }) roomId: number,
    @Args('personality', { type: () => AiPersonality })
    personality: AiPersonality,
  ): Promise<boolean> {
    const userId = ctx.req?.user?.id as number;
    if (!(await this.chatService.isRoomParticipant(userId, roomId))) {
      throw new ForbiddenException('Access denied to this room');
    }
    await this.aiRoomService.setPersonality(roomId, personality);
    return true;
  }

  @Query(() => [Int])
  @UseGuards(GraphQLAuthGuard)
  async getOnlineUser(): Promise<number[] | null> {
    return this.sessionCacheService.getOnlineUser();
  }

  @Query(() => [Int])
  @UseGuards(GraphQLAuthGuard)
  async getAllUsers(@Context() ctx: any): Promise<number[]> {
    const userId = ctx.req?.user?.id as number;
    return this.chatService.getAllUsers(userId);
  }

  @Query(() => [RoomInfoType])
  @UseGuards(GraphQLAuthGuard)
  async getMyRooms(@Context() ctx: any): Promise<RoomInfoType[]> {
    const userId = ctx.req?.user?.id as number;
    return this.chatService.getMyRooms(userId);
  }

  @Query(() => Int, { nullable: true })
  @UseGuards(GraphQLAuthGuard)
  async getRoom(
    @Context() ctx: any,
    @Args('recipientId', { type: () => Int }) recipientId: number,
  ): Promise<number | null> {
    const userId = ctx.req?.user?.id as number;
    return this.chatService.getRoom(userId, recipientId);
  }

  @Query(() => [MessageType])
  @UseGuards(GraphQLAuthGuard)
  async getMessages(
    @Context() ctx: any,
    @Args('roomId', { type: () => Int }) roomId: number,
    @Args('cursor', { type: () => Int, nullable: true }) cursor?: number,
  ): Promise<MessageType[]> {
    const userId = ctx.req?.user?.id as number;
    if (!(await this.chatService.isRoomParticipant(userId, roomId))) {
      throw new ForbiddenException('Access denied to this room');
    }
    const msgs = await this.chatService.getMessages(roomId, cursor);
    return msgs.map((m) => ({ ...m, createdAt: m.created }));
  }

  @Mutation(() => MessageType)
  @UseGuards(GraphQLAuthGuard, RateLimitGuard)
  async sendMessage(
    @Context() ctx: any,
    @Args('input') input: CreateChatInput,
    @Args('recipientId', { type: () => Int }) recipientId: number,
  ): Promise<MessageType | any | null> {
    const userId = ctx.req?.user?.id as number;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedMessage = await this.chatService.sendMessage(
        { sub: userId },
        { message: input.message, recipientId },
        queryRunner,
      );

      await queryRunner.commitTransaction();

      const roomId = savedMessage.room?.id;
      await this.pubSub.publish(`receiveMessage :${roomId}`, {
        receiveMessage: savedMessage,
      });
      // Trigger AI reply asynchronously after transaction commits
      if (roomId && recipientId === this.aiService.getAiUserId()) {
        const personalityToSet = input.aiPersonality ?? null;
        setImmediate(() => {
          (async () => {
            if (personalityToSet) {
              await this.aiRoomService
                .setPersonality(roomId, personalityToSet)
                .catch((err) => {
                  logger.error(
                    `[user=${userId}, room=${roomId}] setPersonality failed: ${(err as Error).message}`,
                  );
                });
            }
            await this.aiService
              .handleReply(roomId, personalityToSet, {
                publishFn: (msg) =>
                  this.pubSub.publish(`receiveMessage :${roomId}`, {
                    receiveMessage: msg,
                  }),
              })
              .catch((err) => {
                logger.error(
                  `[user=${userId}, room=${roomId}] AI reply error: ${(err as Error).message}\n${(err as Error).stack ?? ''}`,
                );
              });
          })();
        });
      }

      return {
        ...savedMessage,
        roomId,
        createdAt: savedMessage.created,
      };
    } catch (err) {
      logger.error(
        `[user=${userId}] ${(err as Error).message}\n${(err as Error).stack ?? ''}`,
      );
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to send message');
    } finally {
      await queryRunner.release();
    }
  }

  @Subscription(() => MessageType, {
    resolve: (payload) => payload.receiveMessage,
    filter: () => true,
  })
  @UseGuards(GraphQLAuthGuard)
  async receiveMessage(
    @Args('roomId', { type: () => ID }) roomId: number,
    @Context() ctx: any,
  ) {
    const userId = ctx.req?.user?.id as number;
    if (!(await this.chatService.isRoomParticipant(userId, roomId))) {
      throw new ForbiddenException('Access denied to this room');
    }
    return this.pubSub.asyncIterableIterator(`receiveMessage :${roomId}`);
  }
}
