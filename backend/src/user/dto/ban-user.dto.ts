// 목적: POST /user/:id/ban의 요청 바디 — 자동 스트라이크 시스템과 무관한 수동 관리자 밴.
// 사용처: user.controller.ts의 ban() 핸들러에서만 임포트.
// 근거: delete-user.dto.ts/update-role.dto.ts와 동일한 패턴 — 새 바디 형태는 인라인 타입이 아닌 별도 DTO로.

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
