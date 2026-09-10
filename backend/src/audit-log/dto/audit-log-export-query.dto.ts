// 목적: GET /audit-log/export 쿼리 형태 — 목록 뷰와 동일한 필터에서 페이지네이션만 제외.
// 사용처: audit-log.controller.ts의 export() 핸들러에서만 import.
// 근거: OmitType을 사용해 AuditLogQueryDto의 class-validator 데코레이터를 중복 없이 동기화.

import { OmitType } from '@nestjs/swagger';
import { AuditLogQueryDto } from './audit-log-query.dto';

export class AuditLogExportQueryDto extends OmitType(AuditLogQueryDto, [
  'page',
  'take',
] as const) {}
