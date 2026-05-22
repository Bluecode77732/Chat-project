// Todo: GraphQL connection
// Resolvers provide the instructions
// for turning a GraphQL operation (a query, mutation, or subscription) into data.
// They return the same shape of data we specify in our schema either synchronously
// or as a promise that resolves to a result of that shape.

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
import { ChatService } from './chat.service';
import { UseGuards } from '@nestjs/common';
import { GraphQLAuthGuard } from 'src/auth/guard/graphql.auth.guard';
import { PubSubService } from 'src/graphql/pubsub.service';
import { DataSource } from 'typeorm';
import { logger } from 'src/base/logger/logger';
import { SessionCacheService } from 'src/redis/redis.service';
import { AuthService } from 'src/auth/auth.service';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    private readonly pubSub: PubSubService,
    //! Debug: Inject QueryRunner for transaction when client request to GraphQL
    private readonly dataSource: DataSource,
    private readonly sessionCacheService: SessionCacheService,
    private readonly authService: AuthService,
  ) { }

  // A dummy query to satisfy root Query requirement
  @Query(() => MessageType)
  ping(): string {
    return 'ping has returned.'; // Fixes the error (GraphQL requires at least one @Query)
  }

  @Query(() => [Int])
  @UseGuards(GraphQLAuthGuard)
  async getOnlineUser(): Promise<number[] | null> {
    return this.sessionCacheService.getOnlineUser();
  }

  @Query(() => Int, { nullable: true })
  @UseGuards(GraphQLAuthGuard)
  async getRoom(
    @Context() ctx: any,
    @Args('recipientId', { type: () => Int }) recipientId: number,
  ): Promise<number | null> {
    const userId = ctx.req?.user?.id;
    return this.chatService.getRoom(userId, recipientId);
  }

  @Query(() => [MessageType])
  @UseGuards(GraphQLAuthGuard)
  async getMessages(
    @Args('roomId', { type: () => Int }) roomId: number,
    @Args('cursor', { type: () => Int, nullable: true }) cursor?: number,
  ): Promise<MessageType[]> {
    return this.chatService.getMessages(roomId, cursor);
  }

  @Mutation(() => MessageType)
  @UseGuards(GraphQLAuthGuard)
  async sendMessage(
    @Context() ctx: any,
    @Args('input') input: CreateChatInput,
    @Args('recipientId', { type: () => Int }) recipientId: number,
  ): Promise<MessageType | any | null> {
    //! Debug - Solving on 'Cannot Find Sender ID': Seems jwt strategy passport cannot populates `req.user`, so GraphQL context cannot find sender id.
    // const token = ctx.req?.headers?.authorization || 1;
    // const tokenSplit = token.split(' ')[1].split('.')[1];
    // const payload = JSON.parse(Buffer.from(tokenSplit, 'base64').toString());
    
    const payload = await this.authService.parseBearerToken(ctx.req?.headers?.authorization || 1, false);
    const userId = payload.sub;

    //! Debug: Inject QueryRunner for transaction when client request to GraphQL
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedMessage = await this.chatService.sendMessage(
        { sub: userId },
        {
          message: input.message,
          recipientId,
        },
        queryRunner,
      );

      await this.pubSub.publish(`receiveMessage :${savedMessage.room?.id}`, {
        receiveMessage: savedMessage,
      });

      //! Debug - Save message in DB: added try/catch/finally, `commitTransaction()`, `rollbackTransaction()`, `release()` in 'chat.resolver'
      await queryRunner.commitTransaction();
      logger.info(`User ${userId}'s message is saved in the chat room`);

      // Recipient online status check before publishing the messages.
      const recipient = await this.sessionCacheService.getUserStatus(recipientId);

      if (!recipient || recipient.status === 'offline') {
        // Leaving messages to the offline recipients
        return savedMessage;
      };

      return { ...savedMessage, roomId: savedMessage.room?.id };

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
    resolve: (payload) => {
      return payload.receiveMessage;
    },
    filter: () => {
      return true; // Accept all for testing
    },
  }) // define ObjectType
  @UseGuards(GraphQLAuthGuard)
  receiveMessage(@Args('roomId', { type: () => ID }) roomId: number) {
    return this.pubSub.asyncIterableIterator(`receiveMessage :${roomId}`);
  }
}
