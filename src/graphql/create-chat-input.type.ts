// This input type bases on CreateChatDto decorator

import { InputType, Field, Int, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

@InputType()
export class CreateChatInput {
    @Field(() => String)
    @IsString()
    @IsNotEmpty()
    message?: string;

    @Field(() => ID)
    @IsNumber()
    recipientId?: number;
    
    @Field(() => Int, { nullable: true })
    @IsNumber()
    @IsOptional()
    room?: number;

}
