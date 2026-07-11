import { ChatEntity } from 'src/chat/entities/chat.entity';
import {
  Column,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EntityBase } from 'src/base/entity/base.entity';
import { UserRole } from 'src/auth/role/role';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { ModerationStatus } from 'src/moderation/enums/moderation-status.enum';

@Entity()
export class UserEntity extends EntityBase {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({
    unique: true,
  })
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email?: string;

  @Column({ default: false })
  isAI?: boolean;

  @Column({ nullable: true, unique: true })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  nickname?: string;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  profileImage?: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  @Exclude({
    // Expose the property only when transforming from class instance to plain object.
    // toPlainOnly: true,
  })
  password?: string;

  // Access level
  @Column({
    enum: UserRole,
    default: UserRole.user,
  })
  @IsNumber()
  @IsNotEmpty()
  role?: number;

  // Moderation state — server-managed only (never set from a client DTO), like isAI.
  @Column({ type: 'varchar', length: 16, default: ModerationStatus.active })
  status?: ModerationStatus;

  // When a timed ban lifts; null = permanent ban or not banned. Effective ban =
  // status === banned && (bannedUntil == null || bannedUntil > now).
  @Column({ type: 'timestamptz', nullable: true })
  bannedUntil?: Date | null;

  // A one-to-many relation allows creating the type of relation where Entity1 can have multiple instances of Entity2, but Entity2 has only one Entity1. Entity2 is the owner of the relationship, and stores the id of Entity1 on its side of the relation.
  @OneToMany(() => ChatEntity, (chat) => chat.participant)
  chats?: ChatEntity[];

  @ManyToMany(() => RoomEntity, (room) => room.participants)
  rooms?: RoomEntity[];
}
