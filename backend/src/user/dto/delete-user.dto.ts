import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty({
    description: 'Current password for identity verification',
    example: 'test@!$!13',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  password!: string;
}
