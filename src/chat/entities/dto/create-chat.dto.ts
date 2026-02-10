import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateChatDto {

    @ApiProperty({
        description: "User Message",
        example: "Type any of context",
        type: String,
    })
    @IsNotEmpty()
    @IsString()
    message: string;

    @ApiProperty({
        description: "A recipient ID who receives sender's message with",
        example: "Receive message",
        type: Number,
    })
    @IsNumber()
    recipientId: number;

    
    // An admin can join in many rooms, while a user join individually.
    @ApiProperty({
        description: "A room where user can join in",
        example: "Join in a room",
        type: Number,
    })
    @IsOptional()
    @IsNumber()
    room?: number;
}
