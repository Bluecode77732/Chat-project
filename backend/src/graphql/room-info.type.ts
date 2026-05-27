import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class RoomInfoType {
  @Field(() => Int)
  roomId: number;

  @Field(() => Int)
  recipientId: number;
}
