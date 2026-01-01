import { UserEntity } from "src/user/entities/user.entity";
import { Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ChatEntity } from "./chat.entity";
import { EntityBase } from "src/base/base.entity";

@Entity()
export class RoomEntity extends EntityBase {
    @PrimaryGeneratedColumn()
    id: number;

    // Participants in many rooms
    @ManyToMany(
        () => UserEntity,
        (user) => user.rooms
    )
    participants: UserEntity[];

    // Chats in the rooms
    @JoinTable()
    @OneToMany(
        () => ChatEntity,
        (room) => room.room,
    )
    chats: ChatEntity[]
}
