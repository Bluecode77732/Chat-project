import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class AdminRoomType {
  @Field(() => Int)
  roomId: number;

  @Field(() => [Int])
  participantIds: number[];
}
