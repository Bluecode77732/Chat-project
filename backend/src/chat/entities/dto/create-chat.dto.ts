import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({
    description: 'User Message',
    example: 'Type any of context',
    type: String,
  })
  @IsNotEmpty()
  @IsString()
  message?: string;

  @ApiProperty({
    description: "A recipient ID who receives sender's message with",
    example: 'Receive message',
    type: Number,
  })
  @IsNumber()
  recipientId?: number;

  // admin은 여러 room에 join 가능; 일반 user는 한 번에 하나만.
  @ApiProperty({
    description: 'A room where user can join in',
    example: 'Join in a room',
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  room?: number;
}
