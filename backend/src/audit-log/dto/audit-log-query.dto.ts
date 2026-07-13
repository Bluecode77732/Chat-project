import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export const AUDIT_ACTIONS = [
  'ROLE_CHANGE',
  'FORCE_LOGOUT',
  'USER_DELETE',
] as const;

export class AuditLogQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: string;

  // Filters logs where the user was actor OR target — covers "what did this user do"
  // and "what was done to this user" in a single query param.
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
