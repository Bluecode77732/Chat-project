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

interface GqlContext {
  req: { user: { id: number }; transactionCommitted?: Promise<void> };
}
import { CreateChatInput } from 'src/graphql/create-chat-input.type';
import { MessageType } from 'src/graphql/message-type.dto';
import { RoomInfoType } from 'src/graphql/room-info.type';
import { AdminRoomType } from 'src/graphql/admin-room.type';
import { UserType } from 'src/graphql/user.type';
import { AiPersonalityInfoType } from 'src/graphql/ai-personality-info.type';
import { ChatService } from './chat.service';
import { ForbiddenException, UseGuards, UseInterceptors } from '@nestjs/common';
import { GraphQLAuthGuard } from 'src/auth/guard/graphql.auth.guard';
import { GraphQLRBACGuard } from 'src/auth/guard/graphql-rbac.guard';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { UserRole } from 'src/auth/role/role';
import { RateLimitGuard } from './guard/rate-limit.guard';
import { PubSubService } from 'src/graphql/pubsub.service';
import type { QueryRunner } from 'typeorm';
import { logger } from 'src/base/logger/logger';
import { SessionCacheService } from 'src/redis/redis.service';
import { AiService } from 'src/ai/ai.service';
import { AiRoomService } from 'src/ai/ai-room.service';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';
import { GqlTransactionInterceptor } from './interceptor/gql-transaction.interceptor';
import { GqlQueryRunnerDecorator } from './decorator/gql-query-runner.decorator';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    private readonly pubSub: PubSubService,
    private readonly sessionCacheService: SessionCacheService,
    private readonly aiService: AiService,
    private readonly aiRoomService: AiRoomService,
  ) {}

  @Query(() => [AdminRoomType])
  @RBAC(UserRole.admin)
  // Order is load-bearing: GraphQLAuthGuard populates req.user; GraphQLRBACGuard reads it.
  @UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)
  async getAllRooms(): Promise<AdminRoomType[]> {
    return this.chatService.findAllRooms();
  }

  @Mutation(() => Boolean)
  @RBAC(UserRole.admin)
  // Order is load-bearing: GraphQLAuthGuard populates req.user; GraphQLRBACGuard reads it.
  @UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)
  async deleteRoom(
    @Args('roomId', { type: () => Int }) roomId: number,
  ): Promise<boolean> {
    await this.chatService.deleteRoom(roomId);
    return true;
  }

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
    @Context() ctx: GqlContext,
    @Args('roomId', { type: () => Int }) roomId: number,
  ): Promise<AiPersonalityInfoType> {
    const userId = ctx.req.user.id;
    if (!(await this.chatService.isRoomParticipant(userId, roomId))) {
      throw new ForbiddenException('Access denied to this room');
    }
    return this.aiRoomService.getPersonalityInfo(roomId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GraphQLAuthGuard)
  async setAiPersonality(
    @Context() ctx: GqlContext,
    @Args('roomId', { type: () => Int }) roomId: number,
    @Args('personality', { type: () => AiPersonality })
    personality: AiPersonality,
  ): Promise<boolean> {
    const userId = ctx.req.user.id;
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
  async getAllUsers(@Context() ctx: GqlContext): Promise<number[]> {
    const userId = ctx.req.user.id;
    return this.chatService.getAllUsers(userId);
  }

  @Query(() => [UserType])
  @UseGuards(GraphQLAuthGuard)
  async getUserNicknames(): Promise<UserType[]> {
    return this.chatService.getUserNicknames();
  }

  @Query(() => [RoomInfoType])
  @UseGuards(GraphQLAuthGuard)
  async getMyRooms(@Context() ctx: GqlContext): Promise<RoomInfoType[]> {
    const userId = ctx.req.user.id;
    return this.chatService.getMyRooms(userId);
  }

  @Query(() => Int, { nullable: true })
  @UseGuards(GraphQLAuthGuard)
  async getRoom(
    @Context() ctx: GqlContext,
    @Args('recipientId', { type: () => Int }) recipientId: number,
  ): Promise<number | null> {
    const userId = ctx.req.user.id;
    return this.chatService.getRoom(userId, recipientId);
  }

  @Query(() => [MessageType])
  @UseGuards(GraphQLAuthGuard)
  async getMessages(
    @Context() ctx: GqlContext,
    @Args('roomId', { type: () => Int }) roomId: number,
    @Args('cursor', { type: () => Int, nullable: true }) cursor?: number,
  ): Promise<MessageType[]> {
    const userId = ctx.req.user.id;
    if (!(await this.chatService.isRoomParticipant(userId, roomId))) {
      throw new ForbiddenException('Access denied to this room');
    }
    const msgs = await this.chatService.getMessages(roomId, cursor);
    return msgs.map((m) => ({ ...m, createdAt: m.created }));
  }

  // Non-idempotent: a client retry after timeout produces a duplicate ChatEntity; RateLimitGuard reduces but does not prevent this.
  @Mutation(() => MessageType)
  @UseGuards(GraphQLAuthGuard, RateLimitGuard)
  @UseInterceptors(GqlTransactionInterceptor)
  async sendMessage(
    @Context() ctx: GqlContext,
    @Args('input') input: CreateChatInput,
    @Args('recipientId', { type: () => Int }) recipientId: number,
    @GqlQueryRunnerDecorator() queryRunner: QueryRunner,
  ): Promise<MessageType> {
    const userId = ctx.req.user.id;
    const transactionCommitted = ctx.req.transactionCommitted;

    const savedMessage = await this.chatService.sendMessage(
      { sub: userId },
      { message: input.message, recipientId },
      queryRunner.manager,
    );

    const roomId = savedMessage.room?.id;
    await this.pubSub.publish(`receiveMessage :${roomId}`, {
      receiveMessage: savedMessage,
    });

    // Notify both participants' sockets about the room only after the transaction
    // commits — emitting earlier let a recipient's immediate subscribe attempt see
    // an uncommitted room and get rejected by isRoomParticipant's access check.
    if (roomId) {
      setImmediate(() => {
        void (async () => {
          await transactionCommitted;
          await this.chatService
            .notifyRoomParticipants(roomId, [userId, recipientId])
            .catch((err) => {
              const errMessage =
                err instanceof Error ? err.message : String(err);
              logger.error(
                `[user=${userId}, room=${roomId}] notifyRoomParticipants failed: ${errMessage}`,
              );
            });
        })();
      });
    }

    // Trigger AI reply asynchronously after transaction commits.
    // GqlTransactionInterceptor commits after this resolver returns, so the trigger
    // awaits ctx.req.transactionCommitted before touching data that depends on the commit.
    if (roomId && recipientId === this.aiService.getAiUserId()) {
      const personalityToSet = input.aiPersonality ?? null;
      setImmediate(() => {
        void (async () => {
          await transactionCommitted;
          if (personalityToSet) {
            await this.aiRoomService
              .setPersonality(roomId, personalityToSet)
              .catch((err) => {
                const errMessage =
                  err instanceof Error ? err.message : String(err);
                logger.error(
                  `[user=${userId}, room=${roomId}] setPersonality failed: ${errMessage}`,
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
              const errMessage =
                err instanceof Error ? err.message : String(err);
              const errStack = err instanceof Error ? (err.stack ?? '') : '';
              logger.error(
                `[user=${userId}, room=${roomId}] AI reply error: ${errMessage}\n${errStack}`,
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
  }

  @Subscription(() => MessageType, {
    resolve: (payload: { receiveMessage: MessageType }) =>
      payload.receiveMessage,
    filter: () => true,
  })
  @UseGuards(GraphQLAuthGuard)
  async receiveMessage(
    @Args('roomId', { type: () => ID }) roomId: number,
    @Context() ctx: GqlContext,
  ) {
    const userId = ctx.req.user.id;
    if (!(await this.chatService.isRoomParticipant(userId, roomId))) {
      throw new ForbiddenException('Access denied to this room');
    }
    return this.pubSub.asyncIterableIterator(
      `receiveMessage :${roomId}`,
    ) as AsyncIterableIterator<{ receiveMessage: MessageType }>;
  }
}
