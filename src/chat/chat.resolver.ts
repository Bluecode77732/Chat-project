// Todo: GraphQL connection
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
import { PubSubService } from 'src/graphql/pubsub.service';

// Todo: GraphQL connection - Comment Out
// const pubSub = new PubSub(); // simple in-memory (for dev/single instance)

@Resolver()
export class ChatResolver {
    constructor(
        private readonly chatService: ChatService,
        private readonly pubSub: PubSubService,
    ) { }

    // A dummy query to satisfy root Query requirement
    @Query(() => MessageType)
    ping(): string {
        return 'ping has returned.'; // Fixes the error (GraphQL requires at least one @Query)
    }

    @Mutation(() => MessageType)
    @UseGuards(GraphQLAuthGuard)
    async sendMessage(
        @Context() ctx: any,
        // @Args('message') message: string,
        @Args('input') input: CreateChatInput,
        @Args('recipientId', { type: () => Int }) recipientId: number,
    ): Promise<MessageType | any | null> {
        console.log('🔵 Mutation received:', { input, recipientId });
        console.log('🔵 PubSub instance in mutation:', this.pubSub.constructor.name);

        // const userId = 1;
        const userId = ctx.req?.user?.sub || 1;
        const savedMessage = await this.chatService.sendMessage(
            { sub: userId },
            {
                message: input.message,
                recipientId,
            },
        );
        console.log('🔵 Saved message:', savedMessage);
        console.log('🔵 Publishing to room:', input.room);
        console.log('🔵 About to publish:', JSON.stringify({ messageAdded: savedMessage }, null, 2));

        await new Promise(delay => setTimeout(delay, 1000));

        if (input.room) {
            await this.pubSub.publish(`messageAdded: ${input.room}`, { messageAdded: savedMessage });
            console.log(`Published to room: ${input.room}`);
        };

        const channel = `messageAdded:${input.room}`;
        console.log('🔵 Publishing to channel:', channel);

        await this.pubSub.publish(channel, { messageAdded: savedMessage });
        console.log('From chat.resolver: Message sent!');
        console.log('🔵 Published successfully');

        return savedMessage || `chat.resolver sends null - ${null}`;
    };

    @Subscription(() => MessageType, {
        resolve: (payload) => {
            console.log('🟢 Subscription resolve called with:', payload);
            return payload.messageAdded;
        },
        filter: (payload, variable) => {
            console.log('🟢 Filter check:', { payload: !!payload, roomId: variable.roomId });
            return true;    // Accept all for testing
        },
    }) // define ObjectType
    @UseGuards(GraphQLAuthGuard)
    messageAdded(
        @Args('roomId', { type: () => ID }) roomId: number,
    ) {
        console.log('🟢 PubSub instance in subscription:', this.pubSub.constructor.name);
        console.log('🟢 Creating iterator for:', `messageAdded:${roomId}`);
        console.log('🟢 Subscription created for room:', roomId);
        console.log('🟢 Testing pubsub with testing message');
        // pubSub.publish(`messageAdded:${roomId}`, {});
        // pubSub.publish(`messageAdded:${roomId}`, {
        //     messageAdded: {
        //         id: 10,
        //         message: "A test Msg",
        //         participant: {
        //             id: 1,
        //         },
        //         createdAt: new Date(),
        //     },
        // });

        const channel = `messageAdded:${roomId}`;
        console.log('🟢 Subscribing to channel:', channel);

        console.log('🟢 Listening to channel:', `messageAdded:${roomId}`);
        return this.pubSub.asyncIterableIterator(`messageAdded:${roomId}`);
    };
}
