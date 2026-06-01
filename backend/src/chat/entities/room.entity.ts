import { UserEntity } from 'src/user/entities/user.entity';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatEntity } from './chat.entity';
import { EntityBase } from 'src/base/entity/base.entity';
import { AiPersonality } from 'src/ai/enums/ai-personality.enum';

@Entity()
export class RoomEntity extends EntityBase {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ type: 'varchar', nullable: true })
  aiPersonality?: AiPersonality | null;

  // Participants in many rooms
  @ManyToMany(() => UserEntity, (user) => user.rooms)
  @JoinTable()
  participants?: UserEntity[];

  // Chats in the rooms
  @OneToMany(() => ChatEntity, (room) => room.room)
  chats?: ChatEntity[];
}
