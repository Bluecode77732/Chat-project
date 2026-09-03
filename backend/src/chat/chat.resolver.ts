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
import { PaginatedAdminRooms } from 'src/graphql/admin-room.type';
import { UserType } from 'src/graphql/user.type';
import { AiPersonalityInfoType } from 'src/graphql/ai-personality-info.type';
import { ChatService } from './chat.service';
import { ForbiddenException, UseGuards, UseInterceptors } from '@nestjs/common';
import { GraphQLAuthGuard } from 'src/auth/guard/graphql.auth.guard';
import { GraphQLRBACGuard } from 'src/auth/guard/graphql-rbac.guard';
import { RBAC } from 'src/auth/decorator/rbac.decorator';
import { UserRole } from 'src/auth/role/role';
import { RateLimitGuard } from './guard/rate-limit.guard';
import { ModerationGuard } from 'src/moderation/moderation.guard';
import { ModerationService } from 'src/moderation/moderation.service';
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
    private readonly moderationService: ModerationService,
  ) {}

  @Query(() => PaginatedAdminRooms)
  @RBAC(UserRole.admin)
  // 순서가 중요: GraphQLAuthGuard가 req.user를 채우고, GraphQLRBACGuard가 이를 읽음.
  @UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)
  async getAllRooms(
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
    page: number,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 20 })
    take: number,
    @Args('sort', { type: () => String, nullable: true, defaultValue: 'DESC' })
    sort: string,
    @Args('sortBy', { type: () => String, nullable: true, defaultValue: 'id' })
    sortBy: string,
    @Args('search', { type: () => String, nullable: true })
    search?: string,
  ): Promise<PaginatedAdminRooms> {
    const sortOrder = sort === 'ASC' ? 'ASC' : 'DESC';
    const sortField = sortBy === 'created' ? 'created' : 'id';
    return this.chatService.findAllRooms(
      page,
      take,
      sortOrder,
      sortField,
      search || undefined,
    );
  }

  @Mutation(() => Boolean)
  @RBAC(UserRole.admin)
  // 순서가 중요: GraphQLAuthGuard가 req.user를 채우고, GraphQLRBACGuard가 이를 읽음.
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

  @Query(() => Int)
  getSystemUserId(): number {
    return this.moderationService.getSystemUserId();
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

  // 비멱등적(non-idempotent): 타임아웃 후 클라이언트 재시도는 중복 ChatEntity를 생성 —
  // RateLimitGuard가 줄여줄 뿐 막지는 못함.
  @Mutation(() => MessageType)
  // 순서가 중요: GraphQLAuthGuard가 req.user를 채우고, RateLimitGuard가 velocity budget을
  // 소비하기 전에 ModerationGuard가 muted/banned 사용자를 걸러냄.
  @UseGuards(GraphQLAuthGuard, ModerationGuard, RateLimitGuard)
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

    // 트랜잭션 커밋 후에만 두 참여자의 소켓에 room을 알림 — 더 일찍 emit하면 recipient의
    // 즉각적인 subscribe 시도가 커밋되지 않은 room을 보고 isRoomParticipant의 접근 체크에서
    // 거부당할 수 있음.
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

    // 모더레이션: 커밋 후 방금 보낸 메시지를 중복/flood 행위 여부로 평가.
    // (AI 트리거와 마찬가지로) 커밋 이후 실행되므로 메시지가 영속화되고 카운트되며,
    // warning/mute/ban 에스컬레이션이 sendMessage 응답에 지연을 더하지 않음.
    if (roomId) {
      setImmediate(() => {
        void (async () => {
          await transactionCommitted;
          await this.moderationService
            .evaluateMessage(userId, input.message ?? '', {
              roomId,
              publishFn: (msg) =>
                this.pubSub.publish(`receiveMessage :${roomId}`, {
                  receiveMessage: msg,
                }),
              disconnectFn: async (uid) => {
                const session =
                  await this.sessionCacheService.getUserStatus(uid);
                if (session?.socketId) {
                  this.chatService.disconnectSocket(session.socketId);
                }
                await this.sessionCacheService.sethUserOffline(uid);
              },
            })
            .catch((err) => {
              const errMessage =
                err instanceof Error ? err.message : String(err);
              logger.error(
                `[user=${userId}, room=${roomId}] moderation evaluate error: ${errMessage}`,
              );
            });
        })();
      });
    }

    // 트랜잭션 커밋 후 비동기로 AI 응답을 트리거.
    // GqlTransactionInterceptor는 이 resolver가 반환된 후 커밋하므로, 커밋에 의존하는
    // 데이터를 건드리기 전에 트리거는 ctx.req.transactionCommitted를 기다림.
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
