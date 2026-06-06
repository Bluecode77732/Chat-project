// This input type bases on CreateChatDto decorator

import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';

@InputType()
export class CreateChatInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  message?: string;

  @Field(() => AiPersonality, { nullable: true })
  @IsEnum(AiPersonality)
  @IsOptional()
  aiPersonality?: AiPersonality;
}
