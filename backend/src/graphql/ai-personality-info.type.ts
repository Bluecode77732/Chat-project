import { ObjectType, Field } from '@nestjs/graphql';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';

@ObjectType()
export class AiPersonalityInfoType {
  @Field(() => AiPersonality, { nullable: true })
  personality?: AiPersonality | null;

  @Field()
  canChange: boolean;
}
