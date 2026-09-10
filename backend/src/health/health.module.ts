// 목적: liveness 엔드포인트를 별도 모듈로 분리 — 코드베이스의 one-module-per-concern
// 관례를 따름.
// 사용처: AppModule에서 한 번만 import; 무언가를 export할 목적은 아님.
// 근거: HealthController는 service/provider 의존성이 없어서 기존 도메인 모듈
// (chat/auth/user 등) 어디에도 속하지 않음.

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
