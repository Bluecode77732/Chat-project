import { ObjectType, Field, ID, PartialType } from '@nestjs/graphql';
import { BaseType } from './base-type';
import { UserRole } from 'src/auth/role/role';

@ObjectType()
export class UserType extends BaseType {
    @Field(() => ID)
    id: number;
    
    @Field({ nullable: true })
    email?: string;

    @Field({ nullable: true })
    password?: string;

    @Field(() => String, { nullable: true })
    role?: UserRole; // or use an Enum if you have UserRole as GraphQL enum

    // chats: ChatEntity[];
    // rooms: RoomEntity[];

    // @Field()
    // createdAt: Date;

    // @Field()
    // updatedAt: Date;
}
