import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { ChatModule } from 'src/chat/chat.module';
import { AuditLogModule } from 'src/audit-log/audit-log.module';

@Module({
  imports: [
    ChatModule,
    AuditLogModule,
    TypeOrmModule.forFeature([UserEntity, RoomEntity]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
