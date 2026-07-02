import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from 'src/auth/auth.module';
import { ChatEntity } from './entities/chat.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { RoomEntity } from './entities/room.entity';
import { ChatResolver } from './chat.resolver';
import { RedisModule } from 'src/redis/redis.module';
import { PubSubService } from 'src/graphql/pubsub.service';
import { AiModule } from 'src/ai/ai.module';
import { GqlTransactionInterceptor } from './interceptor/gql-transaction.interceptor';

@Module({
  imports: [
    AuthModule,
    RedisModule,
    AiModule,
    TypeOrmModule.forFeature([UserEntity, ChatEntity, RoomEntity]),
  ],
  providers: [
    ChatGateway,
    ChatService,
    PubSubService,
    ChatResolver,
    GqlTransactionInterceptor,
  ],
  exports: [ChatService, PubSubService],
})
export class ChatModule {}
