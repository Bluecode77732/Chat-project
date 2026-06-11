import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AiRoomEntity } from './entities/ai-room.entity';
import { AiService } from './ai.service';
import { AiRoomService } from './ai-room.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      ChatEntity,
      RoomEntity,
      AiRoomEntity,
    ]),
  ],
  providers: [AiService, AiRoomService],
  exports: [AiService, AiRoomService],
})
export class AiModule {}
