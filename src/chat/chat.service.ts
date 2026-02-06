import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { DataSource, EntityManager, In, QueryRunner, Repository } from 'typeorm';
import { RoomEntity } from './entities/room.entity';
import { ChatEntity } from './entities/chat.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateChatDto } from './entities/dto/create-chat.dto';
// import { UserRole } from 'src/auth/role/role';
import { WsException } from '@nestjs/websockets';
import { plainToClass } from 'class-transformer';
import { logger } from 'src/base/logger/logger';

@Injectable()
export class ChatService {
    // Maps authenticated userId to get their current Socket instance (1-to-1)
    private readonly clientConnection = new Map<number, Socket>();

    // TypeORM repositories for Room and User with DataSource
    constructor(
        // Injecting TypeORM dependencies for repository
        @InjectRepository(RoomEntity)
        private readonly roomRepository: Repository<RoomEntity>,

        // Injecting TypeORM dependencies for repository
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,

        // Injecting DataSource for transactions
        private readonly dataSource: DataSource,
    ) { };


    // Connect Socket
    registerClient(participantId: number, client: Socket) {
        this.clientConnection.set(participantId, client);
        // this.logger.log(`${Date.UTC} - User ${participantId} has connected`);
        logger.info(`User ${participantId} has connected`);
    };


    // Disconnect Socket
    removeClient(participantId: number) {
        this.clientConnection.delete(participantId);
        // this.logger.log(`User ${participantId} has disconnected`);
        logger.info(`User ${participantId} has disconnected`);
    };


    // Makes the user join all chat rooms they are already a member of
    // Called right after successful authentication during socket connection
    async joinRooms(user: { sub: number }, client: Socket) {
        const rooms = await this.roomRepository.createQueryBuilder('room_Entity')
            .innerJoin('room_Entity.participants', 'participant', 'participant.id = :participantId', {
                participantId: user.sub,
            })
            .getMany();
        // console.log(rooms);
        // console.log(client);
        // Join each room by its string ID (Socket.IO room names are strings)
        rooms.forEach((room) => {
            client.join(room.id.toString());
        });

        console.log(`This is result: ${rooms}`);
        // this.logger.log(`User ${user.sub} has registered`);
        logger.info(`User ${user.sub} has registered`);
        // console.log("User are connected to DB and joined into a room.");
    };


    // Looks for an existing private chat room between exactly two users
    // Uses sorted IDs to ensure consistent lookup (avoids duplicate rooms)
    // returns existing RoomEntity or null
    async findRoom(user1: number, user2: number, manager: EntityManager) {

        if (!user1 || !user2) {
            // console.log("Invalid IDs:", { user1, user2 });
            return null;
        }

        const ids = [user1, user2].sort((a, b) => a - b);

        // console.log(`Searching room for users ${ids[0]} - ${ids[1]}`);

        // this.logger.log(`User ${ids} found a room`);
        logger.info(`User ${ids} found a room`);
        // console.log("finding a room");

        return manager
            .createQueryBuilder(RoomEntity, "room")
            .innerJoin("room.participants", "participant1")
            .innerJoin("room.participants", "participant2")
            .where("participant1.id = :id1", { id1: ids[0] })
            .andWhere("participant2.id = :id2", { id2: ids[1] })
            .getOne();
    };


    // Creates a new private chat room between two users
    // Saves both participants in the many-to-many relation 
    async createRoom(user1: UserEntity, user2: UserEntity, manager: EntityManager) {
        const room = manager.create(RoomEntity, {
            participants: [user1, user2],
        });

        const saved = await manager.save(room);

        if (!saved?.id) {
            throw new WsException("Cannot Find Room");
        };

        // console.log("Saved users into a room");
        // this.logger.log(`User ${user1.id}, ${user2.id} are saved into a room`);
        logger.info(`User ${user1.id}, ${user2.id} are saved into a room`);
        return saved;
    };


    // Find existing room between sender and recipient => or create new one
    // Also notifies both users (if online) about the new room and joins them
    async getOrCreateRoom(sender: UserEntity, recipientId: number, qr: QueryRunner) {

        //?! Fix: The queryRunner type should be its manager, so it does not conflict
        const manager = qr.manager ?? this.roomRepository.manager;

        // console.log("Searching for room between sender:", sender.id, "and recipient:", recipientId);

        let room = await this.findRoom(sender.id, recipientId, manager);

        // console.log("Found existing room?", room ? room.id : "NO ROOM FOUND");

        if (room) {
            // console.log("Reusing room ID:", room.id);
            // reuse existing room
            return room;
        };

        // Find recipient by user ID
        const recipient = await this.userRepository.findOneBy({
            id: recipientId,
        });

        if (!recipient) {
            throw new WsException("Cannot Find Recipient");
        };

        // Create new room 
        room = await this.createRoom(sender, recipient, manager);

        // Notify and join users when they connected
        [sender.id, recipient.id].forEach((id) => {

            // Get Client ID
            const connect = this.clientConnection.get(id);

            if (connect) {
                if (!room?.id) {
                    throw new WsException({
                        status: "error:400 - BadRequestException",
                        message: "Cannot Find Room",
                    });
                    
                } else {
                    // Notifying successful connection
                    connect.emit("CreateRoom", room.id.toString());
                    connect.join(room.id.toString());
                };
            };
        });

        // console.log("created a room");
        // this.logger.log(`User ${sender.id}, ${recipient.id} created a room`);
        logger.info(`User ${sender.id}, ${recipient.id} created a room`);
        return room;
    }


    // Main message sending flow (called from gateway on 'sendMessage' event)
    // - Runs inside transaction
    // - Finds or creates room
    // - Saves message
    // - Broadcasts to room (others see it) + emits back to sender
    async sendMessage(payload: { sub: number }, { message, recipientId }: CreateChatDto) {
        console.log('📨 SendMessage called', { senderId: payload.sub, recipientId });
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        console.log('📨 QueryRunner connected');
        await queryRunner.startTransaction();
        console.log('📨 Transaction started');

        try {
            // 1. Find a client
            const sender = await this.userRepository.findOneByOrFail({
                id: payload.sub,
            });

            // Check if client exist
            if (!sender) {
                throw new WsException("Cannot Find User");
            };

            if (!recipientId || isNaN(recipientId)) {
                throw new WsException("Recipient ID is required and must be a number");
            };

            // Find a recipient
            const recipient = await this.userRepository.findOneBy({
                id: recipientId,
            });

            if (!recipient) {
                throw new WsException("Cannot Find Recipient");
            };

            // Get and create a chat room : transactional
            const room = await this.getOrCreateRoom(sender, recipientId, queryRunner);
            console.log('📨 room obtain', { roomId: room.id });

            // Check if room exist
            if (!room)
                throw new WsException("Cannot Find Room");

            // Save message in the chat database permanently
            // As the internet is disconnected, using transaction is a bright solution for undo the transferring data.
            const messageSchema = await queryRunner.manager.save(ChatEntity, {
                participant: sender,
                message,
                room,
            });
            console.log('📨 Message saved', { messageId: messageSchema.id, roomId: room.id });

            // Get client ID from Socket
            const getClientSocket = this.clientConnection.get(sender.id);

            // console.log("clientSocket found?", !!getClientSocket);
            if (!getClientSocket) {
                // console.log("Current Map keys:", Array.from(this.clientConnection.keys()));
                throw new WsException("Cannot Find Sender ID");
            }

            // Get recipient ID from Socket
            const recipientSocket = this.clientConnection.get(recipient.id);

            if (!getClientSocket) {
                throw new WsException("Cannot Find Sender ID");
            } else {
                // Targets which room to broadcast
                getClientSocket.to(room.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));
            };

            if (!recipientSocket) {
                throw new WsException("Cannot Find Recipient ID");
            } else {
                // console.log("Sender socket exists:", !!this.clientConnection.get(sender.id));
                // console.log("Recipient socket exists:", !!this.clientConnection.get(recipient.id));

                // const senderSocket = this.clientConnection.get(sender.id);
                // console.log("Sender joined rooms:", senderSocket?.rooms);  // Set of room names

                // const recipientSocket = this.clientConnection.get(recipient.id);
                // console.log("Recipient joined rooms:", recipientSocket?.rooms);

                // Emit message in the room
                getClientSocket.emit("SendMessage", plainToClass(ChatEntity, messageSchema));
            };

            await queryRunner.commitTransaction();
            // this.logger.log(`User ${payload.sub}'s message is saved in the chat room`);
            logger.info(`User ${payload.sub}'s message is saved in the chat room`);
            console.log("Message committed to DB with ID:", messageSchema.id);

            // Final return
            // console.log("returning a msg");
            // this.logger.log(`User ${payload.sub} sent a message`);
            logger.info(`User ${payload.sub} sent a message`);
            return message;

            // console.log("returning a msg schema");
            // return messageSchema;

        } catch (error) {
            // console.log(`ERROR: ${error}`);
            logger.error(error.message, { userId: payload.sub, timestamp: new Date().toISOString() });
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        };
    };
}
