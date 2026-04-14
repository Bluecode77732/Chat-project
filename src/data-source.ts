import { DataSource } from 'typeorm';
import { EntityBase } from './base/entity/base.entity';
import { UserEntity } from './user/entities/user.entity';
import { ChatEntity } from './chat/entities/chat.entity';
import { RoomEntity } from './chat/entities/room.entity';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? "5554", 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [EntityBase, UserEntity, ChatEntity, RoomEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
