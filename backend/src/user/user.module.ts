import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [
    ChatModule,
    TypeOrmModule.forFeature([UserEntity, RoomEntity, ChatEntity]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
