import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { QueryRunner, Repository } from 'typeorm';
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

  // TypeORM repositories for Room and User with DataSource
  constructor(
    // Injecting TypeORM dependencies for repository
    @InjectRepository(RoomEntity)
    private readonly roomRepository: Repository<RoomEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,

    @InjectRepository(ChatEntity)
    private readonly chatRepository: Repository<ChatEntity>,

    // Injecting redisService to replace current in-memory storage Socket instance
    private readonly redisService: SessionCacheService,
  ) {}

  // Connect Socket
  async registerClient(participantId: number, client: Socket) {
    await this.redisService.sethUserOnline(participantId, client.id);
    logger.info(`User ${participantId} has connected`);
  }

  // Disconnect Socket
  async removeClient(participantId: number) {
    await this.redisService.sethUserOffline(participantId);
    logger.info(`User ${participantId} has disconnected`);
  }

  // Makes the user join all chat rooms they are already a member of
  // Called right after successful authentication during socket connection
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
    // Join each room by its string ID (Socket.IO room names are strings)
    rooms.forEach((room) => {
      if (!room?.id) {
        throw new WsException('Cannot Find Room');
      }

      client.join(room.id.toString());
      logger.debug(`User ${user.sub} has joined room ${room.id}`);
    });

    logger.info(`User ${user.sub} has registered`);
  }

  // Looks for an existing private chat room between exactly two users
  // Uses sorted IDs to ensure consistent lookup (avoids duplicate rooms)
  // returns existing RoomEntity or null
  async findRoom(user1: number, user2: number, qr: QueryRunner) {
    if (!user1 || !user2) {
      return null;
    }

    const ids = [user1, user2].sort((a, b) => a - b);

    const room = await qr.manager
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

  // Creates a new private chat room between two users
  // Saves both participants in the many-to-many relation
  async createRoom(user1: UserEntity, user2: UserEntity, qr: QueryRunner) {
    const room = qr.manager.create(RoomEntity, {
      participants: [user1, user2],
    });

    const saved = await qr.manager.save(room);

    if (!saved?.id) {
      throw new WsException('Cannot Find Room');
    }

    logger.info(`User ${user1.id}, ${user2.id} are saved into a room`);
    return saved;
  }

  // Find existing room between sender and recipient => or create new one
  // Also notifies both users (if online) about the new room and joins them
  async getOrCreateRoom(
    sender: UserEntity,
    recipientId: number,
    qr: QueryRunner,
  ) {
    if (!sender?.id) {
      throw new WsException('Cannot Find Sender');
    }

    let room = await this.findRoom(sender.id, recipientId, qr);

    if (room) {
      if (room.id) {
        // Notify both users of the existing room ID so their subscriptions can start
        for (const id of [sender.id, recipientId]) {
          const status = await this.redisService.getUserStatus(id);
          if (status?.socketId) {
            this.server
              ?.to(status.socketId)
              .emit('CreateRoom', room.id.toString());
            this.server?.in(status.socketId).socketsJoin(room.id.toString());
          }
        }
      }
      return room;
    }

    // Find recipient by user ID
    const recipient = await this.userRepository.findOneBy({
      id: recipientId,
    });

    if (!recipient) {
      throw new WsException('Cannot Find Recipient');
    }

    // Create new room
    room = await this.createRoom(sender, recipient, qr);

    // Notify and join users when they connected
    for (const id of [sender.id, recipient.id]) {
      if (!id) {
        throw new WsException('Cannot Find Sender');
      }

      const userStatus = await this.redisService.getUserStatus(id);
      if (userStatus?.socketId) {
        if (!room?.id) {
          throw new WsException({
            status: 'error:400 - BadRequestException',
            message: 'Cannot Find Room',
          });
        }
        this.server
          ?.to(userStatus.socketId)
          .emit('CreateRoom', room.id.toString());
        this.server?.in(userStatus.socketId).socketsJoin(room.id.toString());
      }
    }

    logger.info(`User ${sender.id}, ${recipient.id} created a room`);
    return room;
  }

  // Main message sending flow (called from gateway on 'sendMessage' event)
  // - Runs inside transaction
  // - Finds or creates room
  // - Saves message
  // - Broadcasts to room (others see it) + emits back to sender
  async sendMessage(
    payload: { sub: number },
    { message, recipientId }: CreateChatDto,
    queryRunner: QueryRunner,
  ) {
    try {
      // Todo: Find a client
      const sender = await this.userRepository.findOneByOrFail({
        id: payload.sub,
      });

      // Check if client exist
      if (!sender?.id) {
        throw new WsException('Cannot Find Sender');
      }

      if (!recipientId || isNaN(recipientId)) {
        throw new WsException('Recipient ID is required and must be a number');
      }

      // Todo: Get and create a chat room : transactional
      const room = await this.getOrCreateRoom(sender, recipientId, queryRunner);

      // Check if room exist
      if (!room?.id) throw new WsException('Cannot Find Room');

      // Todo: Save message in the chat database permanently
      //* As the internet is disconnected, using transaction is a bright solution for undo the transferring data.
      const messageSchema = Object.assign(
        await queryRunner.manager.save(ChatEntity, {
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
      logger.error(
        `[user=${payload.sub}] ${(err as Error).message}\n${(err as Error).stack ?? ''}`,
      );
      throw new WsException(
        `Failed to send message: ${(err as Error).message}`,
      );
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
    return users.map((u) => u.id!).filter((id) => id !== currentUserId);
  }

  async getUserNicknames(): Promise<UserEntity[]> {
    return this.userRepository.find({
      where: { isAI: false },
      select: ['id', 'nickname'],
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
        return recipient?.id
          ? { roomId: room.id!, recipientId: recipient.id }
          : null;
      })
      .filter((r): r is { roomId: number; recipientId: number } => r !== null);
  }

  disconnectSocket(socketId: string): void {
    this.server?.sockets.sockets.get(socketId)?.disconnect(true);
  }

  async findAllRooms(): Promise<
    { roomId: number; participantIds: number[] }[]
  > {
    const rooms = await this.roomRepository.find({
      relations: ['participants'],
    });
    return rooms.map((room) => ({
      roomId: room.id!,
      participantIds: room.participants?.map((p) => p.id!) ?? [],
    }));
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
