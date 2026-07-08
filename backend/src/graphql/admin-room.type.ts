import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class AdminRoomType {
  @Field(() => Int)
  roomId: number;

  @Field(() => [Int])
  participantIds: number[];
}

@ObjectType()
export class PaginatedAdminRooms {
  @Field(() => [AdminRoomType])
  data: AdminRoomType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  take: number;
}
