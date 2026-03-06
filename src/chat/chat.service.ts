import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
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
    // Maps authenticated userId to get their current Socket instance (1-to-1)
    private readonly clientConnection = new Map<string, Socket>();

    // TypeORM repositories for Room and User with DataSource
    constructor(
        // Injecting TypeORM dependencies for repository
        @InjectRepository(RoomEntity)
        private readonly roomRepository: Repository<RoomEntity>,

        // Injecting TypeORM dependencies for repository
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,

        // Injecting redisService to replace current in-memory storage Socket instance
        private readonly redisService: SessionCacheService,
    ) { };


    // Connect Socket
    async registerClient(participantId: number, client: Socket) {
        console.log('🔍 Before Redis SET:', participantId, client.id);

        await this.redisService.sethUserOnline(participantId, client.id);
        console.log('🔍 After Redis SET');
        this.clientConnection.set(client.id, client);

        logger.info(`User ${participantId} has connected`);
    };


    // Disconnect Socket
    async removeClient(participantId: number, client: Socket) {
        await this.redisService.sethUserOffline(participantId);
        this.clientConnection.delete(client.id);

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

        logger.info(`User ${user.sub} has registered`);
        // console.log("User are connected to DB and joined into a room.");
    };


    // Looks for an existing private chat room between exactly two users
    // Uses sorted IDs to ensure consistent lookup (avoids duplicate rooms)
    // returns existing RoomEntity or null
    async findRoom(user1: number, user2: number, qr: QueryRunner) {

        if (!user1 || !user2) {
            // console.log("Invalid IDs:", { user1, user2 });
            return null;
        }

        const ids = [user1, user2].sort((a, b) => a - b);
        // console.log(`Searching room for users ${ids[0]} - ${ids[1]}`);

        logger.info(`User ${ids} found a room`);
        // console.log("finding a room");

        return qr.manager
            .createQueryBuilder(RoomEntity, "room")
            .innerJoin("room.participants", "participant1")
            .innerJoin("room.participants", "participant2")
            .where("participant1.id = :id1", { id1: ids[0] })
            .andWhere("participant2.id = :id2", { id2: ids[1] })
            .getOne();
    };


    // Creates a new private chat room between two users
    // Saves both participants in the many-to-many relation 
    async createRoom(user1: UserEntity, user2: UserEntity, qr: QueryRunner) {
        const room = qr.manager.create(RoomEntity, {
            participants: [user1, user2],
        });

        const saved = await qr.manager.save(room);

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
        // console.log("Searching for room between sender:", sender.id, "and recipient:", recipientId);

        let room = await this.findRoom(sender.id, recipientId, qr);

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
        room = await this.createRoom(sender, recipient, qr);

        // Notify and join users when they connected
        // [sender.id, recipient.id].forEach(async (id) => {
        for (const id of [sender.id, recipient.id]) {

            // Get Client ID
            // New code along with Redis cache
            const getUserSocketId = await this.redisService.getUserStatus(id);
            const connect = getUserSocketId?.socketId ? this.clientConnection.get(getUserSocketId.socketId) : null;
            // const connect = getUserSocketId ? this.clientConnection.get(getUserSocketId);

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
        };

        logger.info(`User ${sender.id}, ${recipient.id} created a room`);
        return room;
    }


    // Main message sending flow (called from gateway on 'sendMessage' event)
    // - Runs inside transaction
    // - Finds or creates room
    // - Saves message
    // - Broadcasts to room (others see it) + emits back to sender
    //?! Note: Is this parameter correct way? getOrCreateRoom = queryRunner => sendMessage = server?: Server
    async sendMessage(payload: { sub: number }, { message, recipientId }: CreateChatDto, queryRunner: QueryRunner) {
        console.log('📨 SendMessage called', { senderId: payload.sub, recipientId });

        try {
            // Todo: Find a client
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

            // Todo: Find a recipient

            // Todo: Get and create a chat room : transactional
            const room = await this.getOrCreateRoom(sender, recipientId, queryRunner);
            console.log('📨 room obtain', { roomId: room.id });

            // Check if room exist
            if (!room)
                throw new WsException("Cannot Find Room");

            // Todo: Save message in the chat database permanently
            // Todo: As the internet is disconnected, using transaction is a bright solution for undo the transferring data.
            const messageSchema = await queryRunner.manager.save(ChatEntity, {
                participant: sender,
                message,
                room,
            });
            console.log('📨 Message saved', { messageId: messageSchema.id, roomId: room.id });


            //* Redis adoption #5 *//
            // Todo: Get client ID from Redis
            const getSenderFromRedisStatusId = await this.redisService.getUserStatus(sender.id);
            console.log('🔍 Step 1 - Redis returned:', getSenderFromRedisStatusId);
            
            //! Debug: Requiring socketId forcefully was the reason for unable to send msg through GraphQL
            if (getSenderFromRedisStatusId?.socketId) {
                console.log('🔍 Redis socketId:', getSenderFromRedisStatusId?.socketId);
                console.log('❌ No socketId in Redis for sender:', sender.id);
                console.log("🔍 Current Map keys:", Array.from(this.clientConnection.keys()));
                // throw new WsException("Sender isn't online");

                // Todo: Get recipient ID from Socket
                console.log('🔍 Step 2 - Looking for socketId in Map:', getSenderFromRedisStatusId.socketId);
                const senderSocketId = this.clientConnection.get(getSenderFromRedisStatusId?.socketId as string);
                // const recipientSocket = this.clientConnection.get(recipient.id);
                console.log('🔍 Step 3 - Found socket?', !!senderSocketId);


                //! Debug - non-serializable object converting error
                console.log('🔍 About to create messageData');
                console.log('🔍 messageSchema type:', typeof messageSchema);
                console.log('🔍 messageSchema keys:', Object.keys(messageSchema));
                console.log('🔍 sender type:', typeof sender);
                console.log('🔍 sender keys:', Object.keys(sender));
                console.log('🔍 room type:', typeof room);
                console.log('🔍 room keys:', Object.keys(room));


                // Todo: GraphQL connection
                // Broadcast to the rooms
                //! Commented Out
                // senderSocketId.to(room.id.toString());   //! If there's no `emit`, throws "INTERNAL_SERVER_ERROR".
                // senderSocketId.to(room.id.toString()).emit("sendMessage", messageSchema);

                //! Original 
                senderSocketId?.to(room.id.toString()).emit("sendMessage", plainToClass(ChatEntity, messageSchema));
                //! Debug: `serializedMessage`
                // senderSocketId.to(room.id.toString()).emit("sendMessage", serializedMessage);
                console.log('✅ Broadcast to room');

                // Send back to the sender to check if the message was sent
                //! Debug: case-sensitive strings; SendMessage => sendMessage
                //! Commented Out
                // senderSocketId.emit("sendMessage", messageSchema);            

                //! Original 
                senderSocketId?.emit("sendMessage", plainToClass(ChatEntity, messageSchema));
                //! Debug: `serializedMessage`
                // senderSocketId.emit("sendMessage", serializedMessage);
                console.log('✅ Message sent to sender');
            };


            //! What if this server doesn't exist?
            // this.server.to(room.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));


            //* Redis adoption #6 *//
            /** 
             *? Why Recipient Socket Isn't Needed
             * `senderSocket.emit()` sends the message back to the sender for confirmation.
             * The `recipient` receives the message through the room broadcast, not direct emission - no need to fetch their socket separately.
             * `senderSocket.to(room.id.toString()).emit()` already broadcasts to all users in the room except the sender, which includes the recipient if they're online and joined the room.
            */
            //* redis.service : const data = await this.redis.hGetAll(`user:${userId}`);
            //? const getRecipientStatusId = await this.redisService.getUserStatus(recipient.id);
            const getRecipientStatusId = await this.redisService.getUserStatus(recipientId);
            console.log('🔍 Recipient status:', getRecipientStatusId);

            // `redis.service : return data.socketId ? data : null;`
            //? const recipientSocketId = getRecipientStatusId?.socketId ? this.clientConnection.get(getRecipientStatusId.socketId) : null;


            //? Debug: Recipient room check
            if (getRecipientStatusId?.socketId) {
                const recipientSocket = this.clientConnection.get(getRecipientStatusId.socketId);
                console.log('🔍 Recipient socket found?', !!recipientSocket);
                console.log('🔍 Recipient rooms:', recipientSocket ? Array.from(recipientSocket.rooms) : 'no socket');
            } else {
                console.log('⚠️ Recipient not online');
            };

            console.log('🔍 room.id type:', typeof room.id, room.id);
            console.log('🔍 messageSchema:', messageSchema);


            //* Redis adoption #7 *//
            // if (!getSenderStatusId) {
            //     throw new WsException("Cannot Find Sender ID");
            // } else {
            // Targets which room to broadcast
            // senderSocketId.to(room.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));
            // this.server.to(room.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));
            // };

            // if (!recipientSocket) {
            //     throw new WsException("Cannot Find Recipient ID");
            // } else {
            // console.log("Sender socket exists:", !!this.clientConnection.get(sender.id));
            // console.log("Recipient socket exists:", !!this.clientConnection.get(recipient.id));

            // const senderSocket = this.clientConnection.get(sender.id);
            // console.log("Sender joined rooms:", senderSocket?.rooms);  // Set of room names

            // const recipientSocket = this.clientConnection.get(recipient.id);
            // console.log("Recipient joined rooms:", recipientSocket?.rooms);

            // Emit message in the room
            // senderSocketId.emit("SendMessage", plainToClass(ChatEntity, messageSchema));
            // };

            // if (!getSenderStatusId) {
            //     throw new WsException("Cannot Find Sender ID");
            // } else {
            //     // Targets which room to broadcast
            //     getSenderStatusId.to(room.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));
            // };

            // if (!recipientSocket) {
            //     throw new WsException("Cannot Find Recipient ID");
            // } else {
            //     // console.log("Sender socket exists:", !!this.clientConnection.get(sender.id));
            //     // console.log("Recipient socket exists:", !!this.clientConnection.get(recipient.id));

            //     // const senderSocket = this.clientConnection.get(sender.id);
            //     // console.log("Sender joined rooms:", senderSocket?.rooms);  // Set of room names

            //     // const recipientSocket = this.clientConnection.get(recipient.id);
            //     // console.log("Recipient joined rooms:", recipientSocket?.rooms);

            //     // Emit message in the room
            //     getSenderStatusId.emit("SendMessage", plainToClass(ChatEntity, messageSchema));
            // };


            //! Debug: double lifecycle management, the same resource being controlled by two owners simultaneously => Removed transaction queryRunner
            // await queryRunner.commitTransaction();
            // this.logger.log(`User ${payload.sub}'s message is saved in the chat room`);
            logger.info(`User ${payload.sub}'s message is saved in the chat room`);
            console.log("Message committed to DB with ID:", messageSchema.id);

            // Todo: Final return
            // console.log("returning a msg");
            logger.info(`User ${payload.sub} sent a message`);
            // return message;

            console.log("returning a msg schema");
            return messageSchema;

        } catch (error) {
            logger.error(error.message, { userId: payload.sub, timestamp: new Date().toISOString() });

            throw new Error(`Failed to send message: ${error.message}`)
        }
    };
}
