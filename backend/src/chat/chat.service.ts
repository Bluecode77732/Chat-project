import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket, Server } from 'socket.io';
import { QueryRunner, Repository } from 'typeorm';
import { RoomEntity } from './entities/room.entity';
import { ChatEntity } from './entities/chat.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { WsException } from '@nestjs/websockets';
import { plainToClass } from 'class-transformer';
import { logger } from 'src/base/logger/logger';
import { SessionCacheService } from 'src/redis/redis.service';

@Injectable()
export class ChatService {
  private readonly clientConnection = new Map<string, Socket>();
  private server?: Server;

  setBroadcastServer(server: Server): void {
    this.server = server;
  }

  broadcastToRoom(roomId: number, message: ChatEntity): void {
    this.server?.to(roomId.toString()).emit('sendMessage', message);
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
    this.clientConnection.set(client.id, client);

    logger.info(`User ${participantId} has connected`);
  }

  // Disconnect Socket
  async removeClient(participantId: number, client: Socket) {
    await this.redisService.sethUserOffline(participantId);
    this.clientConnection.delete(client.id);

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
      logger.info(`User ${user.sub} has joined room ${room.id}`);
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

    logger.info(`User ${ids} found a room`);

    return qr.manager
      .createQueryBuilder(RoomEntity, 'room')
      .innerJoin('room.participants', 'participant1')
      .innerJoin('room.participants', 'participant2')
      .where('participant1.id = :id1', { id1: ids[0] })
      .andWhere('participant2.id = :id2', { id2: ids[1] })
      .getOne();
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
          const connect = status?.socketId
            ? this.clientConnection.get(status.socketId)
            : null;
          connect?.emit('CreateRoom', room.id.toString());
          connect?.join(room.id.toString());
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

      // Get Client ID
      // New code along with Redis cache
      const getUserSocketId = await this.redisService.getUserStatus(id);
      const connect = getUserSocketId?.socketId
        ? this.clientConnection.get(getUserSocketId.socketId)
        : null;

      if (connect) {
        if (!room?.id) {
          throw new WsException({
            status: 'error:400 - BadRequestException',
            message: 'Cannot Find Room',
          });
        } else {
          // Notifying successful connection
          connect.emit('CreateRoom', room.id.toString());
          connect.join(room.id.toString());
        }
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

      // Todo: Redis adoption //
      // Todo: Get client ID from Redis
      const getSenderFromRedisStatusId = await this.redisService.getUserStatus(
        sender.id,
      );

      //! Debug: Requiring socketId forcefully was the reason for unable to send msg through GraphQL
      if (getSenderFromRedisStatusId?.socketId) {
        // Todo: Get recipient ID from Socket
        const senderSocketId = this.clientConnection.get(
          getSenderFromRedisStatusId?.socketId,
        );

        // Todo: GraphQL connection
        // Broadcast to the rooms
        // Send back to the sender to check if the message was sent
        //! Debug: case-sensitive strings; SendMessage => sendMessage
        senderSocketId
          ?.to(room.id.toString())
          .emit('sendMessage', plainToClass(ChatEntity, messageSchema));

        senderSocketId?.emit(
          'sendMessage',
          plainToClass(ChatEntity, messageSchema),
        );
      }

      const getRecipientStatusId =
        await this.redisService.getUserStatus(recipientId);

      if (!getRecipientStatusId?.socketId) {
        logger.info(
          `Recipient ${recipientId} is offline — message saved, will be loaded from history`,
        );
      }

      logger.info(
        `User ${payload.sub} sent message ${messageSchema.id} to room ${room.id}`,
      );

      return messageSchema;
    } catch (error: any) {
      logger.error(error.message, {
        userId: payload.sub,
        timestamp: new Date().toISOString(),
      });

      throw new WsException(`Failed to send message: ${error.message}`);
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
