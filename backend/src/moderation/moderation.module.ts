// 목적: 행동 기반 모더레이션 관심사(ModerationService + ModerationGuard)를 하나의 모듈로 묶음.
// 사용처: ChatModule(가드 + velocity 훅 + evaluateMessage)과 UserModule(admin unban)에서 임포트; AppModule에 등록.
// 근거: 모더레이션을 캡슐화하고 — ModerationService의 콜백 주입을 통해 — data/Redis/audit에만 의존,
//   ChatModule에는 의존하지 않아 ChatModule <-> ModerationModule 순환을 피함(단방향 의존).

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
