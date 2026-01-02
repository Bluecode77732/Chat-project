import { EntityBase } from "src/base/base.entity";
import { UserEntity } from "src/user/entities/user.entity"
import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { RoomEntity } from "./room.entity";

@Entity()
export class ChatEntity extends EntityBase {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    message: string

    @JoinTable()
    @ManyToOne(
        () => UserEntity,
        (user) => user.chats
    )
    participant: UserEntity;

    // Rooms in a chat
    @ManyToOne(
        () => RoomEntity,
        (room) => room.chats,
    )
    room: RoomEntity;
}
