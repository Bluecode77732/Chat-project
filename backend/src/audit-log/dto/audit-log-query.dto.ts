import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export const AUDIT_ACTIONS = [
  'ROLE_CHANGE',
  'FORCE_LOGOUT',
  'USER_DELETE',
  'USER_UNBAN',
  'USER_MUTED',
  'USER_BANNED',
] as const;

export class AuditLogQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: string;

  // actor 또는 target이 해당 사용자인 로그를 필터링 — 쿼리 파라미터 하나로
  // '이 사용자가 한 일'과 '이 사용자에게 일어난 일'을 모두 커버.
  @ApiPropertyOptional({
    description: 'Filter logs where actorId OR targetId equals this user ID',
  })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort?: 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description:
      'Include logs created at or after this ISO 8601 date (e.g. 2025-07-01).',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Include logs created at or before this ISO 8601 date (e.g. 2025-07-13).',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
