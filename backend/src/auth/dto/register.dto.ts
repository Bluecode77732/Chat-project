import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({
    description: 'Display nickname shown to other users',
    example: 'Joon',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;
}
