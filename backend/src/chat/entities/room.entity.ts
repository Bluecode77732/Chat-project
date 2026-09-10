import { UserEntity } from 'src/user/entities/user.entity';
import {
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatEntity } from './chat.entity';
import { EntityBase } from 'src/base/entity/base.entity';

@Entity()
export class RoomEntity extends EntityBase {
  @PrimaryGeneratedColumn()
  id?: number;

  // 이 방의 참여자들
  @ManyToMany(() => UserEntity, (user) => user.rooms)
  @JoinTable()
  participants?: UserEntity[];

  // 이 방에 속한 채팅들
  @OneToMany(() => ChatEntity, (room) => room.room)
  chats?: ChatEntity[];
}
