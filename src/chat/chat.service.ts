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

        console.log("Rooms are connected to DB.");
    };


    async validateUser(user: UserEntity, room?: number) {
        if (user.role === UserRole.admin) {
            if (!room) {
                // This exception is listened for event-listening in the real-time chat
                throw new WsException("Admin must create a room first.");
            };
        } else {
            throw new WsException("Only admin can create a room.");
        };

        console.log("validated a user");
        return user;
    }


    async createMessage(payload: { sub: number }, { message, room }: CreateChatDto, qr: QueryRunner) {
        // Find a client
        // const client = await qr.manager.findOne(UserEntity, {
        const client = await this.userRepository.findOne({
            where: {
                id: payload.sub,
            },
        });

        // Check if client exist
        if (!client) {
            throw new WsException("Cannot Find User");
        };


        // Get a chat room
        let chatRoom = await this.findRoom(client, qr, room);

        // Check if chat room exist
        // if (!chatRoom) {
        // throw new WsException("Cannot Find Room");
        // };
        // Create a chat room if doesn't exist
        // chatRoom = await this.createRoom(client, qr, room);
        // Recheck if chat room exist
        

        // const findChatRoom = await this.roomRepository.findOne({
        //     where: {
        //         id: payload.sub,
        //     },
        // });
        // if (!findChatRoom) {
        //     throw new WsException("Cannot Find Room");
        // };
        

        const chatRoom = await this.createRoom(client, qr, room);
        if (!chatRoom)
            throw new WsException("Cannot Find Room");

        // Save message in the chat database permanently
        // As the internet is disconnected, using transaction is a bright solution for undo the transferring data.
        const messageSchema = await qr.manager.save(ChatEntity, {
            participant: client,
            message,
            chatRoom,
        });

        // Getting the client ID from Socket
        const clientId = this.clientConnection.get(client.id);

        if (!clientId) {
            throw new WsException("Cannot Find Client ID");
        }

        // Why is this code had written here again
        // if (chatRoom?.id) {
        //     chatRoom = await this.createRoom(client, qr, room);
        // }
        // if (!chatRoom) {
        //     throw new WsException("room hasn't created.")
        // }

        // Targets which room to connect
        // getClientId.to(room.id.toString()).emit('Message Sent', messageSchema);
        clientId.to(chatRoom.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));

        // Final return
        // console.log("created a msg");
        // return message;


        // Targets which room to connect
        // getClientId.to(room.id.toString()).emit('Message Sent', messageSchema);

        // Claude modification
        // this.clientConnection.get(client.id)?.to(chatRoom?.id.toString()).emit('Message sent', plainToClass(ChatEntity, messageSchema));

        // Final return
        console.log("created a msg");
        // return message;
        return messageSchema;
    }


    async findRoom(user: UserEntity, qr: QueryRunner, room?: number) {
        // if (user.role === UserRole.admin) {
        //     if (!room) {
        //         // This exception is listened for event-listening in the real-time chat
        //         throw new WsException("Admin must create a room first.");
        //     };
        //     // if (!room) {
        //     //     return null;
        //     // };

        //     // return qr.manager.findOne(RoomEntity, {
        //     //     where: { id: room },
        //     //     relations: ['participants'],
        //     // });
        // };

        // Using `await` for ensuring exceptions properly to be caught by WebSocket exception handlers
        if (!(user || room)) {
            throw new WsException("User or Room Cannot Found.");
        } else {
            await this.validateUser(user, room);
        }

        console.log("got a room");
        return qr.manager.findOne(RoomEntity, {
            // Find which room
            where: { id: room },
            // Find which room is the participant in
            relations: ['participants'],
        });
    };


    async createRoom(user: UserEntity, qr: QueryRunner, room?: number) {

        // * Separated functions *
        await this.validateUser(user, room);
        const getChatRoom = await this.findRoom(user, qr, room);
        if (getChatRoom) {

            if (user.role === UserRole.admin) {
                if (!room) {
                    // This exception is listened for event-listening in the real-time chat
                    throw new WsException("Admin must create a room first.");
                };
                // if (!room) {
                //     return null;
                // };

                return qr.manager.findOne(RoomEntity, {
                    where: { id: room },
                    relations: ['participants'],
                });
            };

            let chatRoom = await qr.manager
                .createQueryBuilder(RoomEntity, 'chatRoom')
                .innerJoin('chatRoom.participants', 'participant')
                .where('participant.id = :participantId', { participantId: user.id })
                // .where('participant.id IN(:...ids)', {
                //     ids: user.role === UserRole.admin ? [user.id] : [user.id],
                // })
                .getOne();

            if (!chatRoom) {
                const admin = await qr.manager.findOne(UserEntity, {
                    where: { role: UserRole.admin },
                });

                if (!admin) {
                    throw new WsException("Admin Not Found");
                }

                // chatRoom = await this.roomRepository.save({
                //     participants: [user, admin],
                // });
                chatRoom = await qr.manager.save(RoomEntity, {
                    participants: [user, admin],
                });

                [user.id, admin.id].forEach((participantId) => {

                    // Get Client ID
                    const connect = this.clientConnection.get(participantId);

                    if (connect) {
                        if (!chatRoom?.id) {
                            throw new WsException({
                                status: "error:400 - BadRequestException",
                                message: "Cannot Find Room",
                            });
                        } else {
                            // Notifying successful connection
                            connect.emit("CreateRoom", chatRoom.id);
                            connect.join(chatRoom.id.toString());
                        };
                    };
                });
            };

            console.log("created a room");
            return chatRoom;
        }
    }
}
