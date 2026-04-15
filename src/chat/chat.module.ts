import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { ChatEntity } from './entities/chat.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { RoomEntity } from './entities/room.entity';
import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { ChatResolver } from './chat.resolver';
import { RedisModule } from 'src/redis/redis.module';
import { Server } from 'socket.io';
import { PubSubService } from 'src/graphql/pubsub.service';

@Module({
  imports: [
    AuthModule,
    RedisModule,
    TypeOrmModule.forFeature([
      UserEntity,
      ChatEntity,
      RoomEntity,
    ]),
  ],
  providers: [
    ChatGateway,
    ChatService,
    // Todo: GraphQL connection
    Server,
    PubSubService,
    //! Debug - Solving on 'Cannot Find Sender ID' : Registration of 'chat.resolver'
    ChatResolver,
    // Implementing Redis, in chat.module to limit and scoped its connection in chat module only, for sending messages rate-limit and keep user's data
    {
      // Client registers as 'REDIS_CLIENT' provider in NestJS dependency injection
      provide: 'REDIS_CLIENT',
      useFactory: async (configService: ConfigService) => {
        // Creates client instance to connect Redis server
        const client = createClient({ url: configService.get<string>('REDIS_URL') })
        // Connect to Redis server
        await client.connect();
        // Returns connection
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT', ChatService, PubSubService],
})
export class ChatModule { }
