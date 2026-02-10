import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { ChatEntity } from './entities/chat.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { RoomEntity } from './entities/room.entity';
import { createClient } from 'redis';
// import { ChatResolver } from './chat.resolver';
import { RedisModule } from 'src/redis/redis.module';

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
    // Implementing Redis, in chat.module to limit and scoped its connection in chat module only, for sending messages rate-limit and keep user's data
    {
      // Client registers as 'REDIS_CLIENT' provider in NestJS dependency injection
      provide: 'REDIS_CLIENT',
      useFactory: async () => {
        // Creates client instance to connect Redis server
        const client = createClient({ url: 'redis://localhost:6379' }) // default Redis port:6379
        // Connect to Redis server
        await client.connect();
        // Returns connection
        return client;
      },
    },
  ],
  exports: ['REDIS_CLIENT', ChatService],
})
export class ChatModule { }
