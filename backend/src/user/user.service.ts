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
import { And, DataSource, ILike, Not, Repository } from 'typeorm';
import { ModerationStatus } from 'src/moderation/enums/moderation-status.enum';
import { SYSTEM_USER_EMAIL } from 'src/moderation/constants/moderation.constants';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/auth/role/role';
import { logger } from 'src/base/logger/logger';
import Redis from 'ioredis';
import { RoomEntity } from 'src/chat/entities/room.entity';
import { SessionCacheService } from 'src/redis/redis.service';
import { ChatService } from 'src/chat/chat.service';
import { AuditLogService } from 'src/audit-log/audit-log.service';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,

    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,

    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,

    private readonly sessionCacheService: SessionCacheService,

    private readonly chatService: ChatService,

    private readonly auditLogService: AuditLogService,

    private readonly mailService: MailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password, nickname } = createUserDto;

    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    if (user) {
      logger.warn(`Registration attempt for already-existing email: ${email}`);
      throw new BadRequestException('Registration failed');
    }

    if (nickname) {
      const existingNickname = await this.userRepository.findOne({
        where: { nickname },
      });
      if (existingNickname) {
        throw new BadRequestException('Nickname already in use.');
      }
    }

    // 비밀번호 해싱
    const hash = await bcrypt.hash(
      password,
      this.configService.getOrThrow<number>('HASH_ROUNDS'),
    );

    await this.userRepository.save({
      email,
      password: hash,
      role: UserRole.user,
      nickname,
    });
    logger.info(`User '${email}' is created`);

    return await this.userRepository.findOne({
      where: {
        email,
      },
    });
  }

  async findAll(
    page = 1,
    take = 20,
    sort: 'ASC' | 'DESC' = 'DESC',
    sortBy: 'id' | 'role' | 'created' = 'id',
    search?: string,
    status?: ModerationStatus,
    humanOnly?: boolean,
  ): Promise<{
    data: {
      id: number;
      email: string;
      nickname: string | null;
      role: number;
      created: Date;
    }[];
    total: number;
    page: number;
    take: number;
  }> {
    const statusFilter = status ? { status } : {};
    // humanOnly는 시딩된 비인간 계정 둘을 제외함: AI 컴패니언(isAI:true)과
    // 모더레이션 시스템 계정(isAI:false라 대신 이메일 제외로 걸러짐).
    const humanFilter = humanOnly ? { isAI: false } : {};
    const systemEmailExclusion = humanOnly
      ? { email: Not(SYSTEM_USER_EMAIL) }
      : {};
    const nonEmailFilter = { ...statusFilter, ...humanFilter };
    const where = search
      ? [
          {
            // And()가 필요한 건 여기뿐 — 이 분기는 이미 검색 매치용 `email`을 설정하는데,
            // 단순 spread면 systemEmailExclusion의 `email` 키가 이를 조용히 덮어씀
            // (audit-log 날짜 범위에서 겪은 것과 같은 충돌).
            email: humanOnly
              ? And(ILike(`%${search}%`), Not(SYSTEM_USER_EMAIL))
              : ILike(`%${search}%`),
            ...nonEmailFilter,
          },
          {
            nickname: ILike(`%${search}%`),
            ...nonEmailFilter,
            ...systemEmailExclusion,
          },
        ]
      : status || humanOnly
        ? { ...nonEmailFilter, ...systemEmailExclusion }
        : undefined;
    const [rows, total] = await this.userRepository.findAndCount({
      where,
      order: { [sortBy]: sort },
      skip: (page - 1) * take,
      take,
    });
    const data = rows.map((u) => {
      if (
        u.id === undefined ||
        u.email === undefined ||
        u.role === undefined ||
        !u.created
      ) {
        throw new Error(`user entity missing required field: id=${u.id}`);
      }
      return {
        id: u.id,
        email: u.email,
        nickname: u.nickname ?? null,
        role: u.role,
        created: u.created,
      };
    });
    return { data, total, page, take };
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
    // DTO에서 password 추출
    const { password } = updateUserDto;

    // id로 유저 조회
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    // 유저 존재 확인
    if (!user) {
      throw new NotFoundException('No User Found.');
    }

    if (updateUserDto.nickname && updateUserDto.nickname !== user.nickname) {
      const existingNickname = await this.userRepository.findOne({
        where: { nickname: updateUserDto.nickname },
      });
      if (existingNickname && existingNickname.id !== id) {
        throw new BadRequestException('Nickname already in use.');
      }
    }

    // 비밀번호 검증
    if (password) {
      // 비밀번호
      const hash = await bcrypt.hash(
        password,
        this.configService.getOrThrow<number>('HASH_ROUNDS'),
      );

      // 해시를 비밀번호에 적용
      updateUserDto.password = hash;
    }

    // 업데이트
    await this.userRepository.update(
      { id },
      {
        email: updateUserDto.email,
        password: updateUserDto.password,
        nickname: updateUserDto.nickname,
        profileImage: updateUserDto.profileImage,
      },
    );
    await this.redis.del(`user_cache:${id}`);
    logger.info(`User '${user.id}' is updated`);

    // 클라이언트에 결과 반환
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
    const { previousRole, email } = await this.dataSource.transaction(
      'SERIALIZABLE',
      async (manager) => {
        const target = await manager.findOne(UserEntity, {
          where: { id: targetId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!target) throw new NotFoundException('User Not Found.');

        const previousRole = target.role ?? UserRole.user;

        // 마지막 superadmin은 강등 불가 — 강등되면 superadmin이 0명이 되어 DB 접근 없이는 복구 불가.
        if (
          previousRole === UserRole.superadmin &&
          role !== UserRole.superadmin
        ) {
          const superadminCount = await manager.count(UserEntity, {
            where: { role: UserRole.superadmin },
          });
          if (superadminCount <= 1) {
            throw new BadRequestException('Cannot demote the last superadmin.');
          }
        }

        // 상한선은 admin에만 적용 — superadmin은 상한이 없고 여기서 카운트하지 않음.
        if (role === UserRole.admin) {
          const adminCount = await manager.count(UserEntity, {
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

        await manager.update(UserEntity, { id: targetId }, { role });
        return { previousRole, email: target.email };
      },
    );

    await this.redis.del(`user_cache:${targetId}`);

    const roleLabel = (r: number) => UserRole[r] ?? String(r);
    await this.auditLogService.log(
      actorId,
      targetId,
      'ROLE_CHANGE',
      `${roleLabel(previousRole)}→${roleLabel(role)}`,
    );

    if (email) {
      try {
        await this.mailService.sendRoleChangeEmail(email, previousRole, role);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        logger.error(
          `[actor=${actorId}, user=${targetId}] Role change email failed: ${errMessage}`,
        );
      }
    }

    logger.info(
      `[actor=${actorId}, user=${targetId}] Role changed: ${roleLabel(previousRole)} → ${roleLabel(role)}`,
    );
    return { id: targetId, role };
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
    // 존재 확인
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User Not Found.');
    }

    // 시스템 계정(AI 답장/moderation 경고·밴 메시지 발신용) 삭제 방지 —
    // 삭제되면 해당 기능이 통째로 깨짐. 둘 다 실제 로그인 경로가 없어 본인 요청으로는 도달 불가.
    if (user.isAI || user.email === SYSTEM_USER_EMAIL) {
      throw new BadRequestException('Cannot delete a system-managed account.');
    }

    // 비밀번호 본인 확인 (admin이 타인 삭제 시 스킵)
    if (!skipPasswordCheck) {
      if (!password) throw new BadRequestException('Password is required.');
      const valid = await bcrypt.compare(password, String(user.password));
      if (!valid) {
        throw new BadRequestException('Invalid password.');
      }
    }

    // 고아 방 감지용으로 미리 수집
    const myRooms = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'me', 'me.id = :id', { id })
      .select('room.id')
      .getMany();
    const roomIds = myRooms
      .map((r) => r.id)
      .filter((roomId): roomId is number => roomId !== undefined);

    // 소켓 강제 종료용 socketId 조회 (세션 삭제 전)
    const sessionData = await this.sessionCacheService.getUserStatus(id);
    const socketId = sessionData?.socketId;

    // DB 삭제 (단일 트랜잭션)
    //    CASCADE: room_participants 행 자동 제거
    //    SET NULL: chat_entity.participantId = NULL (메시지 익명 보존)
    const orphanedRoomIds: number[] = [];
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(UserEntity, id);

      for (const roomId of roomIds) {
        const remainingCount = await manager
          .createQueryBuilder(RoomEntity, 'room')
          .innerJoin('room.participants', 'p')
          .where('room.id = :roomId', { roomId })
          .getCount();

        if (remainingCount === 0) {
          await manager.delete(RoomEntity, roomId);
          orphanedRoomIds.push(roomId);
        }
      }
    });

    // 커밋 후 고아 방 Redis 캐시 정리
    for (const roomId of orphanedRoomIds) {
      await this.redis.del(`room_messages:${roomId}`);
      logger.info(
        `Orphaned room ${roomId} deleted after user ${id} withdrawal`,
      );
    }

    // Redis 세션 정리
    await this.sessionCacheService.sethUserOffline(id);
    await this.redis.del(`user:${id}`);

    // 현재 액세스 토큰 블랙리스트 등록
    if (rawToken) {
      const token = rawToken.replace(/^Bearer\s+/i, '');
      const ttl = this.configService.get<number>(
        'ACCESS_TOKEN_SECRET_EXPIRES_IN',
        900,
      );
      await this.redis.set(`blacklist:${token}`, '1', 'EX', ttl);
    }

    // 소켓 강제 종료
    if (socketId) {
      this.chatService.disconnectSocket(socketId);
    }

    await this.auditLogService.log(actorId, id, 'USER_DELETE');
    logger.info(`User '${id}' is deleted by actor '${actorId}'`);
    return `The user ${id} is deleted`;
  }
}
