import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class MessageType {
  @Field()
  id: number;

  @Field()
  text: string;

  @Field()
  createdAt: Date;
}