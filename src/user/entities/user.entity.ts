import { ChatEntity } from "src/chat/entities/chat.entity";
import { Column, Entity, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Exclude } from "class-transformer";
import { IsEmail, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { EntityBase } from "src/base/base.entity";
import { UserRole } from "src/auth/role/role";
import { RoomEntity } from "src/chat/entities/room.entity";

@Entity()
export class UserEntity extends EntityBase {
    @PrimaryGeneratedColumn()
    id: number;
    
    @Column({
        unique: true,
    })
    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email: string;
    
    @Column()
    @IsString()
    @IsNotEmpty()
    @Exclude({
        // Expose the property only when transforming from class instance to plain object.
        toPlainOnly: true,
    })
    password: string;
    
    // Access level
    @Column({
        enum: UserRole,
        default: UserRole.signedIn,
    })
    @IsNumber()
    @IsNotEmpty()
    role: number;
    
    // A one-to-many relation allows creating the type of relation where Entity1 can have multiple instances of Entity2, but Entity2 has only one Entity1. Entity2 is the owner of the relationship, and stores the id of Entity1 on its side of the relation.
    @OneToMany(
        () => ChatEntity,
        (chat) => chat.participant,
    )
    chats: ChatEntity[];
    
    @ManyToMany(
        () => RoomEntity,
        (room) => room.participants,
    )
    rooms: RoomEntity[];
}
