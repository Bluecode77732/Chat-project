import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { EntityManager, Repository } from 'typeorm';
import { RoomEntity } from './entities/room.entity';
import { ChatEntity } from './entities/chat.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { WsException } from '@nestjs/websockets';
import { logger } from 'src/base/logger/logger';
import { SessionCacheService } from 'src/redis/redis.service';

@Injectable()
export class ChatService {
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  // DataSource와 함께 Room, User의 TypeORM repository
  constructor(
    // TypeORM 의존성을 repository로 주입
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(ChatEntity)
    private readonly chatRepository: Repository<ChatEntity>,

    // 기존 in-memory Socket 인스턴스 저장을 대체하기 위해 redisService 주입
    private readonly redisService: SessionCacheService,
  ) {}

  // 소켓 연결
  async registerClient(participantId: number, client: Socket) {
    const previous = await this.redisService.getUserStatus(participantId);

    // 이전 소켓을 kick하기 전에 새 소켓을 현재 세션으로 먼저 기록 — kick은 이전 소켓의
    // disconnect 핸들러를 비동기로 트리거하는데, 그 핸들러의 "여전히 현재 세션인지" 확인하는
    // 자체 가드(`removeClient`)가 먼저 실행되면 이 write와 경합해 새 세션의 online 상태를
    // 다시 offline으로 덮어씀.
    await this.redisService.sethUserOnline(participantId, client.id);
    logger.info(`User ${participantId} has connected`);

    if (previous?.socketId && previous.socketId !== client.id) {
      // 다른 곳(예: 다른 브라우저)에서 로그인하면 이 사용자의 단일 활성 연결을 가로챔 —
      // 대체된 소켓에 알려 프런트엔드가 조용히 끊기는 대신 "다른 곳에서 로그인됨"을 표시하도록 함.
      this.kickPreviousSession(previous.socketId);
    }
  }

  private kickPreviousSession(socketId: string): void {
    const previousSocket = this.server?.sockets.sockets.get(socketId);
    if (!previousSocket) return;
    previousSocket.emit('forceLogout', { reason: 'conflict' });
    previousSocket.disconnect(true);
  }

  // 소켓 연결 해제
  async removeClient(participantId: number, socketId: string) {
    const current = await this.redisService.getUserStatus(participantId);
    if (current?.socketId !== socketId) {
      // 더 최신 세션이 이미 이걸 대체함 — 그 online 상태를 덮어쓰지 않음.
      return;
    }

    await this.redisService.sethUserOffline(participantId);
    logger.info(`User ${participantId} has disconnected`);
  }

  // 사용자가 이미 속한 모든 채팅방에 join시킴
  // 소켓 연결 시 인증 성공 직후 호출됨
  async joinRooms(user: { sub: number }, client: Socket) {
    const rooms = await this.roomRepository
      .createQueryBuilder('room_Entity')
      .innerJoin(
        'room_Entity.participants',
        'participant',
        'participant.id = :participantId',
        {
          participantId: user.sub,
        },
      )
      .getMany();
    // 각 room을 문자열 ID로 join(Socket.IO room 이름은 문자열)
    for (const room of rooms) {
      if (!room?.id) {
        throw new WsException('Cannot Find Room');
      }

      await client.join(room.id.toString());
      logger.debug(`User ${user.sub} has joined room ${room.id}`);
    }

    logger.info(`User ${user.sub} has registered`);
  }

  // 정확히 두 사용자 사이의 기존 1:1 채팅방을 조회
  // 정렬된 ID로 sender/recipient 구분과 무관하게 조회를 일관되게 유지 —
  // 같은 쌍에 대해 중복 room 생성을 방지.
  // 기존 RoomEntity 또는 null을 반환
  async findRoom(user1: number, user2: number, manager: EntityManager) {
    if (!user1 || !user2) {
      return null;
    }

    const ids = [user1, user2].sort((a, b) => a - b);

    const room = await manager
      .createQueryBuilder(RoomEntity, 'room')
      .innerJoin('room.participants', 'participant1')
      .innerJoin('room.participants', 'participant2')
      .where('participant1.id = :id1', { id1: ids[0] })
      .andWhere('participant2.id = :id2', { id2: ids[1] })
      .getOne();

    logger.debug(
      `Room lookup for users [${ids.join(', ')}]: ${room ? `found id=${room.id}` : 'not found'}`,
    );
    return room;
  }

  // 두 사용자 사이에 새 1:1 채팅방을 생성
  // 두 참여자를 다대다 관계에 저장
  async createRoom(
    user1: UserEntity,
    user2: UserEntity,
    manager: EntityManager,
  ) {
    const room = manager.create(RoomEntity, {
      participants: [user1, user2],
    });

    const saved = await manager.save(room);

    if (!saved?.id) {
      throw new WsException('Cannot Find Room');
    }

    logger.info(`User ${user1.id}, ${user2.id} are saved into a room`);
    return saved;
  }

  // sender와 recipient 사이의 기존 room을 찾거나 없으면 새로 생성
  // 참여자에게 알리지 않음 — 이는 이 메서드를 감싸는 트랜잭션이 커밋된 후에만
  // 이뤄져야 함(아래 notifyRoomParticipants 참고).
  async getOrCreateRoom(
    sender: UserEntity,
    recipientId: number,
    manager: EntityManager,
  ) {
    if (!sender?.id) {
      throw new WsException('Cannot Find Sender');
    }

    const room = await this.findRoom(sender.id, recipientId, manager);
    if (room) {
      return room;
    }

    // 사용자 ID로 recipient 조회
    const recipient = await this.userRepository.findOneBy({
      id: recipientId,
    });

    if (!recipient) {
      throw new WsException('Cannot Find Recipient');
    }

    // 새 room 생성
    const created = await this.createRoom(sender, recipient, manager);

    logger.info(`User ${sender.id}, ${recipient.id} created a room`);
    return created;
  }

  // room(기존 또는 새로 생성된)에 대해 온라인 상태인 각 참여자의 소켓에 알리고
  // 현재 소켓을 해당 room에 join시킴.
  // room을 조회/생성한 트랜잭션이 커밋된 후에만 호출해야 함: 더 일찍 'CreateRoom'을
  // emit하면 recipient의 즉각적인 subscribe 시도가 커밋과 경합해 isRoomParticipant의
  // 접근 체크에서 거부당하고, 해당 room의 실시간 업데이트를 영구히 놓치게 됨.
  async notifyRoomParticipants(
    roomId: number,
    participantIds: number[],
  ): Promise<void> {
    for (const id of participantIds) {
      const status = await this.redisService.getUserStatus(id);
      if (status?.socketId) {
        this.server?.to(status.socketId).emit('CreateRoom', roomId.toString());
        this.server?.in(status.socketId).socketsJoin(roomId.toString());
      }
    }
  }

  async sendMessage(
    payload: { sub: number },
    { message, recipientId }: CreateChatDto,
    manager: EntityManager,
  ) {
    try {
      const sender = await this.userRepository.findOneByOrFail({
        id: payload.sub,
      });

      // client 존재 여부 확인
      if (!sender?.id) {
        throw new WsException('Cannot Find Sender');
      }

      if (!recipientId || isNaN(recipientId)) {
        throw new WsException('Recipient ID is required and must be a number');
      }

      const room = await this.getOrCreateRoom(sender, recipientId, manager);

      // room 존재 여부 확인
      if (!room?.id) throw new WsException('Cannot Find Room');

      const messageSchema = Object.assign(
        await manager.save(ChatEntity, {
          participant: sender,
          message,
          room,
        }),
        { participant: sender, room },
      );

      logger.info(
        `User ${payload.sub} sent message ${messageSchema.id} to room ${room.id}`,
      );

      return messageSchema;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      const errStack = err instanceof Error ? (err.stack ?? '') : '';
      logger.error(`[user=${payload.sub}] ${errMessage}\n${errStack}`);
      throw new WsException(`Failed to send message: ${errMessage}`);
    }
  }

  async getRoom(userId: number, recipientId: number): Promise<number | null> {
    const [id1, id2] = [userId, recipientId].sort((a, b) => a - b);
    const room = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'p1')
      .innerJoin('room.participants', 'p2')
      .where('p1.id = :id1', { id1 })
      .andWhere('p2.id = :id2', { id2 })
      .getOne();
    return room?.id ?? null;
  }

  async getAllUsers(currentUserId: number): Promise<number[]> {
    const users = await this.userRepository.find({
      where: { isAI: false },
      select: ['id'],
    });
    return users
      .map((u) => u.id)
      .filter((id): id is number => id !== undefined && id !== currentUserId);
  }

  async getUserNicknames(): Promise<UserEntity[]> {
    return this.userRepository.find({
      where: { isAI: false },
      select: ['id', 'nickname', 'profileImage'],
    });
  }

  async getMyRooms(
    userId: number,
  ): Promise<{ roomId: number; recipientId: number }[]> {
    const rooms = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoinAndSelect('room.participants', 'participant')
      .innerJoin('room.participants', 'me', 'me.id = :userId', { userId })
      .getMany();

    return rooms
      .map((room) => {
        const recipient = room.participants?.find((p) => p.id !== userId);
        const recipientId = recipient?.id;
        const roomId = room.id;
        return recipientId !== undefined && roomId !== undefined
          ? { roomId, recipientId }
          : null;
      })
      .filter((r): r is { roomId: number; recipientId: number } => r !== null);
  }

  disconnectSocket(socketId: string): void {
    this.server?.sockets.sockets.get(socketId)?.disconnect(true);
  }

  async findAllRooms(
    page = 1,
    take = 20,
    sort: 'ASC' | 'DESC' = 'DESC',
    sortBy: 'id' | 'created' = 'id',
    search?: string,
  ): Promise<{
    data: { roomId: number; participantIds: number[]; created: Date }[];
    total: number;
    page: number;
    take: number;
  }> {
    const orderColumn = sortBy === 'created' ? 'room.created' : 'room.id';
    const qb = this.roomRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.participants', 'user');

    if (search) {
      qb.where('user.email ILIKE :search OR user.nickname ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const [rooms, total] = await qb
      .orderBy(orderColumn, sort)
      .skip((page - 1) * take)
      .take(take)
      .getManyAndCount();

    const data = rooms.flatMap((room) => {
      const roomId = room.id;
      if (roomId === undefined || !room.created) return [];
      return [
        {
          roomId,
          participantIds: (room.participants ?? [])
            .map((p) => p.id)
            .filter((id): id is number => id !== undefined),
          created: room.created,
        },
      ];
    });
    return { data, total, page, take };
  }

  async deleteRoom(roomId: number): Promise<void> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');
    await this.roomRepository.delete(roomId);
    await this.redisService.deleteMessageCache(roomId);
    logger.info(`Admin deleted room ${roomId}`);
  }

  async isRoomParticipant(userId: number, roomId: number): Promise<boolean> {
    const count = await this.roomRepository
      .createQueryBuilder('room')
      .innerJoin(
        'room.participants',
        'participant',
        'participant.id = :userId',
        { userId },
      )
      .where('room.id = :roomId', { roomId })
      .getCount();
    return count > 0;
  }

  async getMessages(
    roomId: number,
    cursor?: number,
    limit = 15,
  ): Promise<ChatEntity[]> {
    if (!cursor) {
      const cached = await this.redisService.getCachedMessages(roomId);
      if (cached) return cached;
    }

    const qb = this.chatRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.participant', 'participant')
      .where('chat.room = :roomId', { roomId })
      .orderBy('chat.id', 'DESC')
      .take(limit);

    if (cursor) {
      qb.andWhere('chat.id < :cursor', { cursor });
    }

    const messages = await qb.getMany();
    return messages.reverse();
  }
}
