import { Injectable } from '@nestjs/common';
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


    async validateUser(user: UserEntity, room?: number) {
        if (user.role === UserRole.admin) {
            if (!room) {
                // This exception is listened for event-listening in the real-time chat
                throw new WsException("Admin must create a room first.");
            };
        } else {
            throw new WsException("Only admin can create a room.");
        };
    }


    async createMessage(payload: { sub: number }, { message, room: roomId }: CreateChatDto, qr: QueryRunner) {
        // const client = await qr.manager.findOne(UserEntity, {
        const client = await this.userRepository.findOne({
            where: {
                id: payload.sub,
            },
        });

        // 
        const room = await this.getRoom(client!, qr, roomId);

        // 
        if (!room) {
            throw new WsException("Cannot Find Room");
        } else {
            await this.createRoom(client!, qr, roomId);
        };

        // Save message in the chat database permanently
        // Let's say as the internet is disconnected, using transaction is a bright solution for undo the transferring data.
        const messageSchema = await qr.manager.save(ChatEntity, {
            participant: client!,
            message,
            getRoom: room,
        });

        // 
        const getClientId = this.clientConnection.get(client!.id);

        // 
        getClientId?.to(room.id.toString()).emit('Message sent', messageSchema);
        // getClientId?.to(getRoom.id.toString()).emit('Message sent', plainToClass(ChatEntity, messageSchema));

        // Final return
        return message;
    }


    async getRoom(user: UserEntity, qr: QueryRunner, room?: number) {
        // if (user.role === UserRole.admin) {
        //     if (!room) {
        //         // This exception is listened for event-listening in the real-time chat
        //         throw new WsException("Admin must create a room first.");
        //     };

        // Using `await` for ensuring exceptions properly to be caught by WebSocket exception handlers
        await this.validateUser(user, room);

        return await qr.manager.findOne(RoomEntity, {
            // Find which room
            where: { id: room },
            // Find which room is the participant in
            relations: ['participants'],
        });
    };


    async createRoom(user: UserEntity, qr: QueryRunner, room?: number) {

        await this.validateUser(user, room);

        const getChatRoom = await this.getRoom(user, qr, room);

        if (getChatRoom) {
            let chatRoom = await qr.manager
                .createQueryBuilder(RoomEntity, 'room')
                .innerJoin('room.participants', 'participant')
                .where('participant.id = :participantId', { participantId: user.id })
                .getOne();

            if (!chatRoom) {
                const admin = await qr.manager.findOne(UserEntity, {
                    where: { role: UserRole.admin },
                });

                if (!admin) {
                    throw new WsException("Admin user not found");
                }

                chatRoom = await this.roomRepository.save({
                    participants: [user, admin],
                });

                [user.id, admin.id].forEach((participantId) => {
                    // Client connection
                    const connect = this.clientConnection.get(participantId);

                    if (connect) {
                        if (!chatRoom?.id) {
                            throw new WsException({
                                status: "error:400 - BadRequestException",
                                message: "Cannot Find Room",
                            });
                        } else {
                            // Notifying successful connection
                            connect.emit("The room is created", chatRoom?.id);
                            connect.join(chatRoom.id.toString());
                        };
                    };
                });
            };
        }

    }


}
