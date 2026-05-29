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
import { UseGuards } from '@nestjs/common';
import { GraphQLAuthGuard } from 'src/auth/guard/graphql.auth.guard';
import { RateLimitGuard } from './guard/rate-limit.guard';
import { PubSubService } from 'src/graphql/pubsub.service';
import { DataSource } from 'typeorm';
import { logger } from 'src/base/logger/logger';
import { SessionCacheService } from 'src/redis/redis.service';
import { AuthService } from 'src/auth/auth.service';
import { AiService } from 'src/ai/ai.service';
import { AiRoomService } from 'src/ai/ai-room.service';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';
import { ChatEntity } from './entities/chat.entity';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    private readonly pubSub: PubSubService,
    private readonly dataSource: DataSource,
    private readonly sessionCacheService: SessionCacheService,
    private readonly authService: AuthService,
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
    @Args('roomId', { type: () => Int }) roomId: number,
  ): Promise<AiPersonalityInfoType> {
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
    const payload = await this.authService.parseBearerToken(
      ctx.req?.headers?.authorization,
      false,
    );
    await this.aiRoomService.setPersonality(
      roomId,
      payload.sub,
      personality,
      false,
    );
    return true;
  }

  @Query(() => [Int])
  @UseGuards(GraphQLAuthGuard)
  async getOnlineUser(): Promise<number[] | null> {
    return this.sessionCacheService.getOnlineUser();
  }

  @Query(() => [RoomInfoType])
  @UseGuards(GraphQLAuthGuard)
  async getMyRooms(@Context() ctx: any): Promise<RoomInfoType[]> {
    const payload = await this.authService.parseBearerToken(
      ctx.req?.headers?.authorization,
      false,
    );
    return this.chatService.getMyRooms(payload.sub);
  }

  @Query(() => Int, { nullable: true })
  @UseGuards(GraphQLAuthGuard)
  async getRoom(
    @Context() ctx: any,
    @Args('recipientId', { type: () => Int }) recipientId: number,
  ): Promise<number | null> {
    const payload = await this.authService.parseBearerToken(
      ctx.req?.headers?.authorization,
      false,
    );
    return this.chatService.getRoom(payload.sub, recipientId);
  }

  @Query(() => [MessageType])
  @UseGuards(GraphQLAuthGuard)
  async getMessages(
    @Args('roomId', { type: () => Int }) roomId: number,
    @Args('cursor', { type: () => Int, nullable: true }) cursor?: number,
  ): Promise<MessageType[]> {
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
    const payload = await this.authService.parseBearerToken(
      ctx.req?.headers?.authorization,
      false,
    );
    const userId = payload.sub;

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
      logger.info(`User ${userId}'s message is saved in the chat room`);

      // Trigger AI reply asynchronously after transaction commits
      if (roomId && recipientId === this.aiService.getAiUserId()) {
        if (input.aiPersonality && roomId) {
          await this.aiRoomService.setPersonality(
            roomId,
            userId,
            input.aiPersonality,
            true,
          );
        }
        setImmediate(() => {
          this.aiService
            .handleReply(
              roomId,
              input.message ?? '',
              input.aiPersonality ?? null,
              {
                broadcastFn: (msg: ChatEntity) =>
                  this.chatService.broadcastToRoom(roomId, msg),
                publishFn: (msg: ChatEntity) =>
                  this.pubSub.publish(`receiveMessage :${roomId}`, {
                    receiveMessage: msg,
                  }),
              },
            )
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              logger.error(`AI reply error: ${msg}`, {
                timestamp: new Date().toISOString(),
              });
            });
        });
      }

      return {
        ...savedMessage,
        roomId,
        createdAt: savedMessage.created,
      };
    } catch (error: any) {
      logger.error(error.message, {
        userId: userId,
        timestamp: new Date().toISOString(),
      });
      await queryRunner.rollbackTransaction();
      throw new Error(`Failed to send message: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  @Subscription(() => MessageType, {
    resolve: (payload) => payload.receiveMessage,
    filter: () => true,
  })
  @UseGuards(GraphQLAuthGuard)
  receiveMessage(@Args('roomId', { type: () => ID }) roomId: number) {
    return this.pubSub.asyncIterableIterator(`receiveMessage :${roomId}`);
  }
}
