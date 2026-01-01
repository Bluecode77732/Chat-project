import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { QueryRunner, Repository } from 'typeorm';
import { RoomEntity } from './entities/chat.room.entity';
import { ChatEntity } from './entities/chat.entity';
import { UserEntity } from 'src/user/entities/user.entity';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { UserRole } from 'src/auth/role/role';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class ChatService {
    private readonly connectedClients = new Map<number, Socket>();

    constructor(
        @InjectRepository(RoomEntity)
        private readonly chatRoomRepository: Repository<RoomEntity>,

        @InjectRepository(ChatEntity)
        private readonly chatRepository: Repository<ChatEntity>,

        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
    ) { };


    async registerClient(userId: number, client: Socket) {
        this.connectedClients.set(userId, client);
    };


    async removeClient(userId: number) {
        this.connectedClients.delete(userId);
    };


    async joinRooms(user: { sub: number }, client: Socket) {
        const chatRooms = await this.chatRoomRepository.createQueryBuilder('chatRoomEntity')
            .innerJoin('chatRoomEntity.users', 'user', 'user.id = :userId', {
                userId: user.sub,
            })
            .getMany();

        chatRooms.forEach((room) => {
            client.join(room.id.toString());
        });
    };


    async createMessage(payload: { sub: number }, { message: msg, room }: CreateChatDto) {
        const user = this.chatRepository.findOne({
            where: {
                id: payload.sub,
            },
        });

        const chatRoom = await this.
    }


    async getChatRoom(user: UserEntity, qr: QueryRunner, room?: number) {
        if (user.role === UserRole.admin) {
            if (!room) {
                // This exception is listened for event-listening in the real-time chat
                throw new WsException("Admin must create a room first.");
            };

            return qr.manager.findOne(RoomEntity, {
                // Find which room
                where: { id: room },
                // Find which room is the participant in
                relations: ['participants'],
            });
        };
    }


    async createChatRoom(user: UserEntity, qr: QueryRunner, room?: number) {
        
        const getChatRoom = await this.getChatRoom(user, qr, room);

        if (getChatRoom) {
            let chatRoom = await qr.manager
            .createQueryBuilder(RoomEntity, 'chatRoom')
            .innerJoin('chatRoom.participants', 'participant')
            .where("participant.id = :participantId", { participantId: user.id })
            .getOne()
            ;
            
            if (!chatRoom) {
                const admin = await qr.manager.findOne(UserEntity, {
                    where: {
                        role: UserRole.admin,
                    },
                });

                chatRoom = await this.chatRoomRepository.save({
                    participants: [user, admin],
                });
            };

        }
        
    }


}
