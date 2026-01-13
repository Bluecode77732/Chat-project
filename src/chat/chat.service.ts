import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
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

        private readonly dataSource: DataSource,
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


    async findRoom(user1: number, user2: number, qr: QueryRunner) {
        // Using `await` for ensuring exceptions properly to be caught by WebSocket exception handlers
        // if (!(user || room)) {
        //     throw new WsException("User or Room Cannot Found.");
        // } else {
        //     await this.validateUser(user, room);
        // }

        const [id1, id2] = [user1, user2].sort((a, b) => a - b);

        console.log("got a room");
        // ? Can this code run?
        // return qr.manager.findOne(RoomEntity, {
        //     where: [
        //         { participants: { id: id1 } },
        //         { participants: { id: id2 } },
        //     ],
        //     relations: ['participants'],
        // });
        return qr.manager.findOne(RoomEntity, {
            // Find which room
            where: {
                // Find which room is the participant in
                participants: {
                    id: In([id1, id2]),
                },
            },
            relations: ['participants'],
            join: {
                alias: 'room',
                innerJoinAndSelect: {
                    participants: 'room.participants',
                },
            },
        });
    };


    async createRoom(user1: UserEntity, user2: UserEntity, qr: QueryRunner) {
        const room = qr.manager.create(RoomEntity, {
            participants: [user1, user2],
        });

        const saved = await qr.manager.save(room);

        if (!saved?.id) {
            throw new WsException("Cannot Find Room");
        };

        console.log("Saved users into a room");
        return saved;
    };

    
    async getAndCreateRoom(sender: UserEntity, recipientId: number, qr: QueryRunner) {

        // // let chatRoom = await qr.manager
        // //     .createQueryBuilder(RoomEntity, 'chatRoom')
        // //     .innerJoin('chatRoom.participants', 'participant')
        // //     .where('participant.id = :participantId', { participantId: user.id })
        // //     .getOne();

        const manager = qr ? qr.manager : this.roomRepository.manager;

        let room = await this.findRoom(sender.id, recipientId, qr);

        if (room) {
            return room;
        };

        // Find recipient
        const recipient = await this.userRepository.findOneBy({
            id: recipientId,
        });

        if (!recipient) {
            throw new WsException("Cannot Find Recipient");
        };

        // Store users into a room
        room = await this.createRoom(sender, recipient, qr);

        // // room = await qr.manager.save(RoomEntity, {
        // //     participants: [user1, user2],
        // // });

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

        console.log("created a room");
        return room;
    }


    async sendMessage(payload: { sub: number }, { message, recipientId }: CreateChatDto, qr: QueryRunner) {

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        // Find a client
        const sender = await this.userRepository.findOneByOrFail({
            id: payload.sub,
        });

        // Check if client exist
        if (!sender) {
            throw new WsException("Cannot Find User");
        };

        try {
            // // Find a recipient
            const recipient = await this.userRepository.findOneBy({
                id: recipientId,
            });

            if (!recipient) {
                throw new WsException("Cannot Find Recipient");
            };


            // Get and create a chat room
            const room = await this.getAndCreateRoom(sender, recipientId, qr);

            // Check if room exist
            if (!room)
                throw new WsException("Cannot Find Room");

            // Save message in the chat database permanently
            // As the internet is disconnected, using transaction is a bright solution for undo the transferring data.
            const messageSchema = await qr.manager.save(ChatEntity, {
                participant: sender,
                message,
                chatRoom: room,
            });

            // Get client ID from Socket
            const clientSocket = this.clientConnection.get(sender.id);
            // Get recipient ID from Socket
            const recipientSocket = this.clientConnection.get(recipient.id);

            if (!clientSocket) {
                throw new WsException("Cannot Find Sender ID");
            } else {
                // Targets which room to broadcast
                clientSocket.to(room.id.toString()).emit("SendMessage", plainToClass(ChatEntity, messageSchema));
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

        } catch (error) {
            console.log(`ERROR: ${error}`)
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release()
        };
    }


    // async getAndCreateRoom(user: UserEntity, qr: QueryRunner, room?: number) {
    //     const user1 = await this.findRoom(user, qr, room);
    //     const user2 = await this.userRepository.findOne({
    //         where: {
    //             id: user.id,
    //         },
    //     });

    //     if (!user1) {
    //         throw new WsException("");
    //     };
    //     if (!user2) {
    //         throw new WsException("");
    //     };

    //     // Todo 1: Save users in room entity
    //     // Todo 2: Consider extracting few lines from `createMessage` into `getAndCreateRoom`
    //     return qr.manager.save(RoomEntity, {
    //         participants: [user1, user2],
    //     });

    // }
}
