import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

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
}
