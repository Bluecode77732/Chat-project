// Purpose: query shape for GET /audit-log/export — same filters as the list view, minus pagination.
// Usage: imported by audit-log.controller.ts's export() handler only.
// Rationale: OmitType keeps AuditLogQueryDto's class-validator decorators in sync instead of duplicating them.

import { OmitType } from '@nestjs/swagger';
import { AuditLogQueryDto } from './audit-log-query.dto';

export class AuditLogExportQueryDto extends OmitType(AuditLogQueryDto, [
  'page',
  'take',
] as const) {}
