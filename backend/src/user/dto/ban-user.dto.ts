// Purpose: request body for POST /user/:id/ban — manual admin ban, independent of the automatic strike system.
// Usage: imported by user.controller.ts's ban() handler only.
// Rationale: mirrors delete-user.dto.ts/update-role.dto.ts — a new body shape gets its own DTO, not an inline type.

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class BanUserDto {
  @ApiPropertyOptional({
    description: 'Reason recorded in the audit log.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Ban duration in seconds. Omit for a permanent ban.',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationSec?: number;
}
