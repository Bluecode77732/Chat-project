import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
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
  providers: [
    AiService,
    AiRoomService,
    {
      provide: 'GENAI_CLIENT',
      useFactory: (configService: ConfigService) =>
        new GoogleGenAI({
          apiKey: configService.getOrThrow<string>('GEMINI_API_KEY'),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [AiService, AiRoomService],
})
export class AiModule {}
