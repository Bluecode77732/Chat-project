// Purpose: packages the behavioral-moderation concern (ModerationService + ModerationGuard) as one module.
// Usage: imported by ChatModule (guard + velocity hook + evaluateMessage) and UserModule (admin unban); registered in AppModule.
// Rationale: encapsulates moderation and — via callback injection in ModerationService — depends only on data/Redis/audit,
//   never on ChatModule, so the ChatModule <-> ModerationModule cycle is avoided (one-directional dependency).

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/entities/user.entity';
import { ChatEntity } from 'src/chat/entities/chat.entity';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AuditLogModule } from 'src/audit-log/audit-log.module';
import { ModerationService } from './moderation.service';
import { ModerationGuard } from './moderation.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, ChatEntity, RoomEntity]),
    AuditLogModule,
  ],
  providers: [ModerationService, ModerationGuard],
  exports: [ModerationService, ModerationGuard],
})
export class ModerationModule {}
