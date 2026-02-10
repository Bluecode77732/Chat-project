// Resolvers provide the instructions 
// for turning a GraphQL operation (a query, mutation, or subscription) into data. 
// They return the same shape of data we specify in our schema either synchronously 
// or as a promise that resolves to a result of that shape.


import { Resolver, Subscription, Mutation, Args, Query, Context, ID, Int } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions'; // or use own injectable PubSub
import { CreateChatInput } from 'src/graphql/create-chat-input.type';
import { MessageType } from 'src/graphql/message-type.dto';
import { ChatService } from './chat.service';
import { UseGuards } from '@nestjs/common';
import { GraphQLAuthGuard } from 'src/auth/guard/graphql.auth.guard';


const pubSub = new PubSub(); // simple in-memory (for dev/single instance)

@Resolver()
export class ChatResolver {
    constructor(
        private readonly chatService: ChatService,
    ) { }

    // A dummy query to satisfy root Query requirement
    @Query(() => MessageType)
    ping(): string {
        return 'ping has returned.'; // <= fixes the error (GraphQL requires at least one @Query)
    }

    @Mutation(() => MessageType)
    @UseGuards(GraphQLAuthGuard)
    async sendMessage(
        @Context() ctx: any,
        // @Args('message') message: string,
        @Args('input') input: CreateChatInput,
        @Args('recipientId', { type: () => Int }) recipientId: number,
    ): Promise<string | null> {
        const userId = ctx.req?.user?.sub || 1;
        const savedMessage = await this.chatService.sendMessage(
            { sub: userId },
            {
                message: input.message,
                recipientId,
            },
            // {
            //     message: input.message,
            //     recipientId: input.recipientId
            // },
        );
        const roomId = input.room;

        pubSub.publish(`messageAdded:${roomId}`, { messageAdded: savedMessage });

        console.log('From chat.resolver: Message sent!');
        return savedMessage || null;
    };

    @Subscription(() => MessageType) // define your ObjectType
    @UseGuards(GraphQLAuthGuard)
    messageAdded(
        @Args('roomId', { type: () => ID }) roomId: number,
    ) {
        return pubSub.asyncIterableIterator(`messageAdded:${roomId}`);
    };
}
