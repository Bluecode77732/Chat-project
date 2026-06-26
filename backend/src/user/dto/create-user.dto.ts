import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// 2MB raw image, base64-inflated (ceil(n/3)*4) plus a small margin for the data-URI prefix
const MAX_PROFILE_IMAGE_BASE64_LENGTH = 2_796_300;

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

  @ApiProperty({
    description: 'Profile image as a base64 data URI (jpeg/png/webp, max 2MB)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, {
    message:
      'profileImage must be a base64 data URI (image/jpeg, image/png, or image/webp)',
  })
  @MaxLength(MAX_PROFILE_IMAGE_BASE64_LENGTH)
  profileImage?: string;
}
