import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { ChatModule } from 'src/chat/chat.module';
import { AuditLogModule } from 'src/audit-log/audit-log.module';
import { MailModule } from 'src/mail/mail.module';
import { ModerationModule } from 'src/moderation/moderation.module';

@Module({
  imports: [
    ChatModule,
    AuditLogModule,
    MailModule,
    ModerationModule,
    TypeOrmModule.forFeature([UserEntity, RoomEntity]),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
