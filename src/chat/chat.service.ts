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
        const chatRooms = await this.roomRepository.createQueryBuilder('chatRoomEntity')
            .innerJoin('chatRoomEntity.users', 'user', 'user.id = :userId', {
                userId: user.sub,
            })
            .getMany();

        chatRooms.forEach((room) => {
            client.join(room.id.toString());
        });
    };


    async validateUser(user: UserEntity, room?: number) {
        if (user.role === UserRole.admin) {
            if (!room) {
                // This exception is listened for event-listening in the real-time chat
                throw new WsException("Admin must create a room first.");
            };
        }
    }


    async createMessage(payload: { sub: number }, { message, room }: CreateChatDto, qr: QueryRunner) {
        const client = this.chatRepository.findOne({
            where: {
                id: payload.sub,
            },
        });

        const chatRoom = await this.createRoom(client, qr, room)
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

        const getChatRoom = await this.getRoom(user, qr, room);

        if (getChatRoom) {
            let room : RoomEntity | null = await qr.manager
                .createQueryBuilder(RoomEntity, 'room')
                .innerJoin('room.participants', 'participant')
                .where('participant.id = :participantId', { participantId: user.id })
                .getOne();

            if (!room) {
                const admin = await qr.manager.findOne(UserEntity, {
                    where: { role: UserRole.admin },
                });

                if (!admin) {
                    throw new WsException("Admin user not found");
                }

                room = await this.roomRepository.save({
                    participants: [user, admin],
                });

                [user.id, admin.id].forEach((participantId) => {
                    // Client connection
                    const client = this.clientConnection.get(participantId);
                    
                    if (client) {
                        // Notifying successful connection
                        client.emit("The room is created", room?.id);
                        client.join(room!.id.toString());
                    };
                })
            };
        }

    }


}
