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
        const rooms = await this.roomRepository.createQueryBuilder('chatRoomEntity')
            .innerJoin('chatRoomEntity.participants', 'participant', 'participant.id = :participantId', {
                participantId: user.sub,
            })
            .getMany();

        rooms.forEach((room) => {
            client.join(room.id.toString());
        });

        console.log("Rooms are connected to DB.");
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


    async findUserById(userId: number): Promise<UserEntity> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user)
            throw new WsException('User not found');

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
        // let chatRoom = await this.findRoom(client, qr, room);

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


        // Create a chat room

        const participant = await this.findUserById(payload.sub);
        const chatRoom = await this.getOrCreateRoom(client, qr, room);
        if (!chatRoom)
            throw new WsException("Cannot Find Room");
        const messageSchema = await this.messageSchema(client, message, chatRoom, qr);


        // Save message in the chat database permanently
        // As the internet is disconnected, using transaction is a bright solution for undo the transferring data.
        // const messageSchema = await qr.manager.save(ChatEntity, {
        //     participant: client,
        //     message,
        //     chatRoom,
        // });

        // Getting the client ID from Socket
        // const clientId = this.clientConnection.get(client.id);

        // if (!clientId) {
        //     throw new WsException("Cannot Find Client ID");
        // };

        // Why is this code had written here again
        // if (chatRoom?.id) {
        //     chatRoom = await this.createRoom(client, qr, room);
        // }
        // if (!chatRoom) {
        //     throw new WsException("room hasn't created.")
        // }

        // Targets which room to connect
        // getClientId.to(room.id.toString()).emit('Message Sent', messageSchema);
        // clientId.to(chatRoom.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));

        // 
        this.broadcastMessage(participant.id, chatRoom.id, messageSchema);

        // Final return
        console.log("created a msg");
        return message;


        // Targets which room to connect
        // getClientId.to(room.id.toString()).emit('Message Sent', messageSchema);

        // Final return
        // console.log("created a msg");
        // return message;
        // return messageSchema;
    }


    async findUserRoom(userId: number, qr: QueryRunner, room?: number) {
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
        // if (!(user || room)) {
        //     throw new WsException("User or Room Cannot Found.");
        // } else {
        //     await this.validateUser(user, room);
        // }

        console.log("Found a room");

        return await qr.manager
            .createQueryBuilder(RoomEntity, 'chatRoom')
            .innerJoin('chatRoom.participants', 'participant')
            .where('participant.id = :participantId', { participantId: userId })
            .getOne();
        // .where('participant.id IN(:...ids)', {
        //     ids: user.role === UserRole.admin ? [user.id] : [user.id],
        // })
    };


    // async getAndCreateRoom(user: UserEntity, qr: QueryRunner, room?: number) {
    async findAdminRoom(roomId: number, qr: QueryRunner) {
        if (!roomId) {
            throw new WsException("Admin Must Insert A Room ID");
        }

        // * Separated Orchestrations *
        // if (await this.validateUser(user, room)) {
        return qr.manager.findOne(RoomEntity, {
            // Find which room
            where: { id: roomId },
            // Find which room is the participant in
            relations: ['participants'],
        });
        // };
    }


    async getRoom(user: UserEntity, qr: QueryRunner) {
        // Get a chat room
        let room = await this.findUserRoom(user.id, qr);

        if (!room) {
            room = await this.createRoom(user, qr);

            const adminUser = await qr.manager.findOne(UserEntity, {
                where: {
                    role: UserRole.admin,
                },
            });

            if (!adminUser) {
                throw new WsException("User Cannot Find");
            };

            this.roomCreateNotification(room, [user.id, adminUser?.id]);
        }

        return room;
        // return qr.manager.findOne(RoomEntity, {
        //     where: { id: }
        // })
    }


    async createRoom(user: UserEntity, qr: QueryRunner) {
        // const chatRoom = await this.findRoom(user.id, qr, room);

        // chatRoom = await this.createRoom(client, qr, room);
        // if (!chatRoom) {


        const admin = await this.userRepository.findOne({
            where: {
                role: UserRole.admin
            },
        });

        if (!admin) {
            throw new WsException("Admin Not Found");
        };

        return await qr.manager.save(RoomEntity, {
            participants: [user, admin],
        });


        // chatRoom = await this.roomRepository.save({
        //     participants: [user, admin],
        // });

        // [user.id, admin.id].forEach((participantId) => {

    };

    // console.log("created a room");
    // return chatRoom;

    // }

    getOrCreateRoom(user: UserEntity, qr: QueryRunner, room?: number) {

        if (!room)
            throw new WsException("Admin Not Found");

        return user.role === UserRole.admin
            ? this.findAdminRoom(room, qr)
            : this.findUserRoom(user.id, qr);
    }


    async messageSchema(participant: UserEntity, message: string, room: RoomEntity, qr: QueryRunner) {
        // Using transaction to abort when internet disconnected
        return await qr.manager.save(ChatEntity, {
            participant,
            message,
            room,
        });
    };


    roomCreateNotification(chatRoom: RoomEntity, userIds: number[]) {
        userIds.forEach((participantId) => {
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
        })

        // [user.id, admin.id].forEach((participantId) => {

        //     // Get Client ID
        // });
    };


    broadcastMessage(participantId: number, roomId: number, message: ChatEntity) {
        const connect = this.clientConnection.get(participantId);

        if (!connect) {
            throw new WsException("Connection Failed");
        };

        connect.to(roomId.toString()).emit("sendMsg", plainToClass(ChatEntity, message));
    };
}
