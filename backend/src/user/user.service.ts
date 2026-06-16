import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/auth/role/role';
import { logger } from 'src/base/logger/logger';
import Redis from 'ioredis';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { SessionCacheService } from 'src/redis/redis.service';
import { ChatService } from 'src/chat/chat.service';
import { AuditLogService } from 'src/audit-log/audit-log.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,

    private readonly configService: ConfigService,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,

    private readonly sessionCacheService: SessionCacheService,

    private readonly chatService: ChatService,

    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password } = createUserDto;

    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    if (user) {
      logger.warn(`Registration attempt for already-existing email: ${email}`);
      throw new BadRequestException('Registration failed');
    }

    // Hashing user password
    const hash = await bcrypt.hash(
      password,
      this.configService.getOrThrow<number>('HASH_ROUNDS'),
    );

    await this.userRepository.save({
      email,
      password: hash,
      role: UserRole.user,
    });
    logger.info(`User '${email}' is created`);

    return await this.userRepository.findOne({
      where: {
        email,
      },
    });
  }

  async findAll() {
    return await this.userRepository.find();
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException(`User Cannot Found`);
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    // Bring password from DTO
    const { password } = updateUserDto;

    // Find the user by id
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    // Checking the user
    if (!user) {
      throw new NotFoundException('No User Found.');
    }

    // Password verify
    if (password) {
      // Password
      const hash = await bcrypt.hash(
        password,
        this.configService.getOrThrow<number>('HASH_ROUNDS'),
      );

      // Apply hash to password
      updateUserDto.password = hash;
    }

    // Update
    await this.userRepository.update(
      { id },
      {
        email: updateUserDto.email,
        password: updateUserDto.password,
      },
    );
    await this.redis.del(`user_cache:${id}`);
    logger.info(`User '${user.id}' is updated`);

    // Returning result to client
    return await this.userRepository.findOne({
      where: {
        id,
      },
    });
  }

  async updateRole(
    actorId: number,
    targetId: number,
    role: UserRole,
  ): Promise<UserEntity> {
    const target = await this.userRepository.findOne({
      where: { id: targetId },
    });
    if (!target) throw new NotFoundException('User Not Found.');

    const previousRole = target.role ?? UserRole.user;

    // 마지막 superadmin 강등 방지
    if (previousRole === UserRole.superadmin && role !== UserRole.superadmin) {
      const superadminCount = await this.userRepository.count({
        where: { role: UserRole.superadmin },
      });
      if (superadminCount <= 1) {
        throw new BadRequestException('Cannot demote the last superadmin.');
      }
    }

    // admin 수 상한 (superadmin은 별도 카운트)
    if (role === UserRole.admin) {
      const adminCount = await this.userRepository.count({
        where: { role: UserRole.admin },
      });
      const maxAdminCount = this.configService.get<number>(
        'MAX_ADMIN_COUNT',
        5,
      );
      if (adminCount >= maxAdminCount) {
        throw new BadRequestException(
          `Admin count limit (${maxAdminCount}) reached.`,
        );
      }
    }

    await this.userRepository.update({ id: targetId }, { role });

    const roleLabel = (r: number) => UserRole[r] ?? String(r);
    await this.auditLogService.log(
      actorId,
      targetId,
      'ROLE_CHANGE',
      `${roleLabel(previousRole)}→${roleLabel(role)}`,
    );

    return { ...target, role };
  }

  async forceLogout(actorId: number, targetId: number): Promise<void> {
    const session = await this.sessionCacheService.getUserStatus(targetId);
    if (session?.socketId) {
      this.chatService.disconnectSocket(session.socketId);
    }
    await this.sessionCacheService.sethUserOffline(targetId);
    await this.auditLogService.log(actorId, targetId, 'FORCE_LOGOUT');
    logger.info(
      `User '${targetId}' was force-logged out by actor '${actorId}'`,
    );
  }

  async remove(
    actorId: number,
    id: number,
    password?: string,
    rawToken?: string,
    skipPasswordCheck = false,
  ) {
    // ① 존재 확인
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User Not Found.');
    }

    // ② 비밀번호 본인 확인 (admin이 타인 삭제 시 스킵)
    if (!skipPasswordCheck) {
      if (!password) throw new BadRequestException('Password is required.');
      const valid = await bcrypt.compare(password, String(user.password));
      if (!valid) {
        throw new BadRequestException('Invalid password.');
      }
    }

    // ③ 삭제 전: 이 유저가 속한 방 목록 수집 (고아 방 감지용)
    const myRooms = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'me', 'me.id = :id', { id })
      .select('room.id')
      .getMany();
    const roomIds = myRooms.map((r) => r.id!);

    // ④ 소켓 강제 종료용 socketId 조회 (세션 삭제 전)
    const sessionData = await this.sessionCacheService.getUserStatus(id);
    const socketId = sessionData?.socketId;

    // ⑤ 유저 삭제
    //    CASCADE: room_participants 행 자동 제거
    //    SET NULL: chat_entity.participantId = NULL (메시지 익명 보존)
    await this.userRepository.delete(id);

    // ⑥ 고아 방 정리: 참가자가 0명이 된 방 삭제
    //    CASCADE: chat_entity.roomId 행 자동 삭제
    for (const roomId of roomIds) {
      const remainingCount = await this.roomRepository
        .createQueryBuilder('room')
        .innerJoin('room.participants', 'p')
        .where('room.id = :roomId', { roomId })
        .getCount();

      if (remainingCount === 0) {
        await this.roomRepository.delete(roomId);
        await this.redis.del(`room_messages:${roomId}`);
        logger.info(
          `Orphaned room ${roomId} deleted after user ${id} withdrawal`,
        );
      }
    }

    // ⑦ Redis 세션 정리
    await this.sessionCacheService.sethUserOffline(id);
    await this.redis.del(`user:${id}`);

    // ⑧ 현재 액세스 토큰 블랙리스트 등록
    if (rawToken) {
      const token = rawToken.replace(/^Bearer\s+/i, '');
      const ttl = this.configService.get<number>(
        'ACCESS_TOKEN_SECRET_EXPIRES_IN',
        900,
      );
      await this.redis.set(`blacklist:${token}`, '1', 'EX', ttl);
    }

    // ⑨ 소켓 강제 종료
    if (socketId) {
      this.chatService.disconnectSocket(socketId);
    }

    await this.auditLogService.log(actorId, id, 'USER_DELETE');
    logger.info(`User '${id}' is deleted by actor '${actorId}'`);
    return `The user ${id} is deleted`;
  }
}
