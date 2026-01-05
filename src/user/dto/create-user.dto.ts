import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";
import { UserRole } from "src/auth/role/role";

export class CreateUserDto {

    @ApiProperty({
        description: "User Email",
        example: "x@gmail.com",
        type: String,
    })
    @IsNotEmpty()
    @IsEmail()
    email: string;
    
    @ApiProperty({
        description: "User Password",
        example: "test@!$!13",
        type: 'string',
    })
    @IsNotEmpty()
    @IsString()
    password: string;

    @ApiProperty({
        description: "Access Level",
        example: "1",
        type: 'number',
    })
    @IsNotEmpty()
    @IsEnum(UserRole)
    role: UserRole;
}
