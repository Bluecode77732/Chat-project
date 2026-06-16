import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty({
    description:
      'Current password for identity verification (required for self-deletion; omit when admin deletes another user)',
    example: 'test@!$!13',
    type: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  password?: string;
}
