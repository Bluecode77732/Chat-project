// This input type bases on CreateChatDto decorator

import { InputType, Field, Int, ID } from '@nestjs/graphql';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';

@InputType()
export class CreateChatInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  message?: string;

  @Field(() => ID)
  @IsNumber()
  recipientId?: number;

  @Field(() => Int, { nullable: true })
  @IsNumber()
  @IsOptional()
  room?: number;

  @Field(() => AiPersonality, { nullable: true })
  @IsEnum(AiPersonality)
  @IsOptional()
  aiPersonality?: AiPersonality;
}
