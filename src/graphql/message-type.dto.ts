import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserType } from './user.type';

@ObjectType()
export class MessageType {
  @Field(() => ID)
  id: number;

  @Field()
  message: string;

  @Field(() => UserType, { nullable: true })
  participant?: UserType;

  @Field()
  createdAt?: Date;
}