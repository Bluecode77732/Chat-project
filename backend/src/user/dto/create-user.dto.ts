import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// 2MB 원본 이미지를 base64로 인코딩한 크기(ceil(n/3)*4) + data-URI 프리픽스 여유분
const MAX_PROFILE_IMAGE_BASE64_LENGTH = 2_796_300;

export class CreateUserDto {
  @ApiProperty({
    description: 'User Email',
    example: 'x@gmail.com',
    type: String,
  })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
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
  @MaxLength(20, { message: '닉네임은 20자 이하여야 합니다.' })
  nickname?: string;

  @ApiProperty({
    description: 'Profile image as a base64 data URI (jpeg/png/webp, max 2MB)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, {
    message: '프로필 이미지는 jpeg, png, webp 형식이어야 합니다.',
  })
  @MaxLength(MAX_PROFILE_IMAGE_BASE64_LENGTH)
  profileImage?: string;
}
