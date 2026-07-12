import { ObjectType, Field, Int } from '@nestjs/graphql';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';

@ObjectType()
export class AdminRoomType {
  @Field(() => Int)
  roomId!: number;

  @Field(() => [Int])
  participantIds!: number[];

  @Field()
  created!: Date;

  // null = no AI configured for this room; non-null = current personality setting.
  // Populated by resolver via batch query — not stored on RoomEntity itself.
  @Field(() => AiPersonality, { nullable: true })
  aiPersonality?: AiPersonality | null;
}

@ObjectType()
export class PaginatedAdminRooms {
  @Field(() => [AdminRoomType])
  data!: AdminRoomType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  take!: number;
}
