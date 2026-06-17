import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'User Email',
    example: 'x@gmail.com',
    type: String,
  })
  @IsNotEmpty()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'User Password',
    example: 'test@!$!13',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  password!: string;

  @ApiProperty({
    description: 'Display nickname shown to other users',
    example: 'Joon',
    type: 'string',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;
}
