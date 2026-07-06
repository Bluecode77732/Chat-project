import { EntityBase } from 'src/base/entity/base.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RoomEntity } from './room.entity';

@Entity()
export class ChatEntity extends EntityBase {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  message?: string;

  @ManyToOne(() => UserEntity, (user) => user.chats, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  participant?: UserEntity | null;

  // Rooms in a chat
  @ManyToOne(() => RoomEntity, (room) => room.chats, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  room?: RoomEntity | null;
}
