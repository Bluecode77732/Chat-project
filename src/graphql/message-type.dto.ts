import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { UserType } from './user.type';

@ObjectType()
export class MessageType {
  @Field(() => ID)
  id?: number;

  @Field()
  message?: string;

  @Field(() => UserType, { nullable: true })
  participant?: UserType;

  @Field()
  createdAt?: Date;

  @Field(() => Int, { nullable: true })
  roomId?: number;
}
