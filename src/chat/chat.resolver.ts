// Resolvers provide the instructions 
// for turning a GraphQL operation (a query, mutation, or subscription) into data. 
// They return the same shape of data we specify in our schema either synchronously 
// or as a promise that resolves to a result of that shape.


import { Resolver, Subscription, Mutation, Args, Query } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions'; // or use own injectable PubSub
import { MessageType } from './type/message-Type.dto';

const pubSub = new PubSub(); // simple in-memory (for dev/single instance)

@Resolver()
export class ChatResolver {

    @Query(() => String)
    hello(): string {
        return 'Hello World'; // <= fixes the error (GraphQL requires at least one @Query)
    }

    @Mutation(() => String)
    async sendMessage(@Args('text') text: string): Promise<string> {
        const message = { id: Date.now(), text, createdAt: new Date() };
        pubSub.publish('messageAdded', { messageAdded: message });
        return 'Message sent!';
    }

    @Subscription(() => MessageType) // define your ObjectType
    messageAdded() {
        return pubSub.asyncIterableIterator('messageAdded');
    }
}