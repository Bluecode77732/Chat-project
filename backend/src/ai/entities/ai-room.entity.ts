import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { AiPersonality } from '../enums/ai-personality.enum';
import { EntityBase } from 'src/base/entity/base.entity';

@Entity()
export class AiRoomEntity extends EntityBase {
  @PrimaryGeneratedColumn()
  id?: number;

  @OneToOne(() => RoomEntity)
  @JoinColumn({ name: 'room_id' })
  room!: RoomEntity;

  @Column({ type: 'varchar' })
  personality!: AiPersonality;
}
