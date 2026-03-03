import { ObjectType, Field, ID } from '@nestjs/graphql';
import { UserRole } from 'src/auth/role/role';
import { BaseType } from './base.type';

@ObjectType()
export class UserType extends BaseType {
    @Field(() => ID)
    id: number;
    
    @Field({ nullable: true })
    email?: string;

    //* Fix: Removed showing password
    // @Field({ nullable: true })
    // password?: string;

    @Field(() => String, { nullable: true })
    role?: UserRole; // or use an Enum if you have UserRole as GraphQL enum
}
