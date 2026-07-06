import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class AuditLogEntity {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  actorId!: number;

  @Column({ nullable: true, type: 'int' })
  targetId?: number;

  @Column()
  action!: string;

  @Column({ nullable: true })
  detail?: string;

  @CreateDateColumn()
  created?: Date;
}
