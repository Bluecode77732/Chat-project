import { registerEnumType } from '@nestjs/graphql';

export enum AiPersonality {
  FRIENDLY = 'FRIENDLY',
  CODING = 'CODING',
  ENGLISH = 'ENGLISH',
  CREATIVE = 'CREATIVE',
}

registerEnumType(AiPersonality, { name: 'AiPersonality' });

export const AI_PERSONALITY_LABELS: Record<AiPersonality, string> = {
  [AiPersonality.FRIENDLY]: '친절한 어시스턴트',
  [AiPersonality.CODING]: '코드 도우미',
  [AiPersonality.ENGLISH]: '영어 선생님',
  [AiPersonality.CREATIVE]: '창의적인 작가',
};
