import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { QueryRunner, Repository } from 'typeorm';
import { RoomEntity } from './entities/room.entity';
import { ChatEntity } from './entities/chat.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { UserRole } from 'src/auth/role/role';
import { WsException } from '@nestjs/websockets';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ChatService {
    private readonly clientConnection = new Map<number, Socket>();

    constructor(
        @InjectRepository(RoomEntity)
        private readonly roomRepository: Repository<RoomEntity>,

        @InjectRepository(ChatEntity)
        private readonly chatRepository: Repository<ChatEntity>,

        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
    ) { };


    registerClient(participantId: number, client: Socket) {
        this.clientConnection.set(participantId, client);
    };


    removeClient(participantId: number) {
        this.clientConnection.delete(participantId);
    };


    async joinRooms(user: { sub: number }, client: Socket) {
        const rooms = await this.roomRepository.createQueryBuilder('roomEntity')
            .innerJoin('roomEntity.participants', 'participant', 'participant.id = :participantId', {
                participantId: user.sub,
            })
            .getMany();

        rooms.forEach((room) => {
            client.join(room.id.toString());
        });

        console.log("Users are connected to DB and joined into a room.");
    };


    // async validateUser(user: UserEntity, room?: number) {
    //     if (user.role === UserRole.admin) {
    //         if (!room) {
    //             // This exception is listened for event-listening in the real-time chat
    //             throw new WsException("Admin must create a room first.");
    //         };
    //     } else {
    //         throw new WsException("Only admin can create a room.");
    //     };

    //     console.log("validated a user");
    //     return user;
    // }


    async findRoom(user: UserEntity, qr: QueryRunner, room?: number) {
        // Using `await` for ensuring exceptions properly to be caught by WebSocket exception handlers
        // if (!(user || room)) {
        //     throw new WsException("User or Room Cannot Found.");
        // } else {
        //     await this.validateUser(user, room);
        // }

        console.log("got a room");
        return qr.manager.findOne(RoomEntity, {
            // Find which room
            where: { id: room },
            // Find which room is the participant in
            relations: ['participants'],
        });
    };


    async createRoom(user: UserEntity, qr: QueryRunner, room?: number) {

        const user1 = await this.findRoom(user, qr, room);
        const user2 = await this.findRoom(user, qr, room);

        if (!user1) {
            throw new WsException("");
        };
        if (!user2) {
            throw new WsException("");
        };


        let chatRoom = await qr.manager
            .createQueryBuilder(RoomEntity, 'chatRoom')
            .innerJoin('chatRoom.participants', 'participant')
            .where('participant.id = :participantId', { participantId: user.id })
            .getOne();

        if (!chatRoom) {
            // Store users into room
            chatRoom = await qr.manager.save(RoomEntity, {
                participants: [user1, user2],
            });

            [user1.id, user2.id].forEach((participantId) => {

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


    async createMessage(payload: { sub: number }, { message, recipientId }: CreateChatDto, qr: QueryRunner) {
        // Find a client
        const sender = await this.userRepository.findOne({
            where: {
                id: payload.sub,
            },
        });

        // Check if client exist
        if (!sender) {
            throw new WsException("Cannot Find User");
        };

        // Find a recipient
        const recipient = await this.userRepository.findOne({
            where: {
                id: recipientId,
            },
        });

        if (!recipient) {
            throw new WsException("Cannot Find Recipient");
        };


        // Get and create a chat room
        const chatRoom = await this.getAndCreateRoom(sender, qr, room);

        if (!chatRoom)
            throw new WsException("Cannot Find Room");

        // Save message in the chat database permanently
        // As the internet is disconnected, using transaction is a bright solution for undo the transferring data.
        const messageSchema = await qr.manager.save(ChatEntity, {
            participant: sender,
            message,
            chatRoom,
        });

        // Get client ID from Socket
        const clientSocket = this.clientConnection.get(sender.id);
        // Get recipient ID from Socket
        const recipientSocket = this.clientConnection.get(recipient.id);

        if (!clientSocket) {
            throw new WsException("Cannot Find Sender ID");
        } else {
            // Targets which room to broadcast
            clientSocket.to(chatRoom.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));
        };

        if (!recipientSocket) {
            throw new WsException("Cannot Find Recipient ID");
        } else {
            // Emit which room to send
            clientSocket.emit("SendMessage", plainToClass(ChatEntity, messageSchema));
        };

        // Final return
        // console.log("returning a msg");
        // return message;

        console.log("returning a msg schema");
        return messageSchema;
    }


    async getAndCreateRoom(user: UserEntity, qr: QueryRunner, room?: number) {
        // const userValidation = await this.validateUser(user, room);

        // if (!userValidation) {
        //     throw new WsException("Unauthorized approach");
        // };

        let findRoom = await this.findRoom(user, qr, room);

        if (!findRoom) {
            throw new WsException("Cannot Find Room");
        } else {
            findRoom = await this.createRoom(user, qr, room);
        };

        // Todo 1: Save users in room entity
        // Todo 2: Consider extracting few lines from `createMessage` into `getAndCreateRoom`
        return qr.manager.save(RoomEntity, {
            participants: [user, user2],
        });

    }
}
