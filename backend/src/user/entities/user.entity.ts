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
    // 클래스 인스턴스 → 일반 객체로 변환할 때만 이 속성을 노출함.
    // toPlainOnly: true,
  })
  password?: string;

  // 권한 등급
  // emitDecoratorMetadata의 design:type 추론이 ts-jest(tsconfig isolatedModules) 아래서
  // import된 enum 속성에 대해 신뢰할 수 없어 Object로 잡히고, TypeORM의 postgres 드라이버가
  // 이를 거부하므로 type: 'int'를 명시함.
  @Column({
    type: 'int',
    enum: UserRole,
    default: UserRole.user,
  })
  @IsNumber()
  @IsNotEmpty()
  role?: UserRole;

  // 모더레이션 상태 — isAI처럼 서버에서만 관리하며 클라이언트 DTO로는 절대 설정하지 않음.
  @Column({ type: 'varchar', length: 16, default: ModerationStatus.active })
  status?: ModerationStatus;

  // 기간제 밴이 풀리는 시점; null이면 영구 밴이거나 밴이 아님.
  // 실질적인 밴 여부 = status === banned && (bannedUntil == null || bannedUntil > now).
  @Column({ type: 'timestamptz', nullable: true })
  bannedUntil?: Date | null;

  // 일대다 관계는 Entity1이 여러 개의 Entity2를 가질 수 있고 Entity2는 하나의 Entity1만
  // 가지는 관계 유형임 — Entity2가 관계의 소유자이며, 자기 쪽에 Entity1의 id를 저장함.
  @OneToMany(() => ChatEntity, (chat) => chat.participant)
  chats?: ChatEntity[];

  @ManyToMany(() => RoomEntity, (room) => room.participants)
  rooms?: RoomEntity[];
}
