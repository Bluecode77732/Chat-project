import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserRole } from 'src/auth/role/role';
import { BaseType } from './base.type';

@ObjectType()
export class UserType extends BaseType {
  @Field(() => ID)
  id?: number;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  nickname?: string;

  @Field({ nullable: true })
  profileImage?: string;

  @Field(() => String, { nullable: true })
  role?: UserRole; // UserRole을 GraphQL enum으로 쓴다면 Enum 타입을 써도 됨
}
