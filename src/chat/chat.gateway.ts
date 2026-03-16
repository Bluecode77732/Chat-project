import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { WebSocketTransaction } from './interceptor/ws.transaction.interceptor';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { RateLimitGuard } from './guard/rate-limit.guard';
import { RBACguard } from 'src/auth/guard/rbac.guard';
import type { QueryRunner } from 'typeorm';
import { WebSocketQueryRunner } from './decorator/ws-query-runner.decorator';

@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {  
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) { }

  async handleConnection(client: Socket) {
    console.log('🔌 Connection attempt');
    try {
      // Bearer ir3j9rkdokaods
      const rawToken = client.handshake.headers?.authorization;
      // const rawToken = client.handshake.headers?.authorization || client.handshake.auth?.token || client.handshake.query?.token;
      console.log('🔍 Token received:', !!rawToken);

      // Bearer token payload
      const payload = await this.authService.parseBearerToken(String(rawToken), false);
      console.log('🔍 Payload:', payload);

      if (payload) {
        // Put bearer token into data.user to be extracted by 
        client.data.user = payload;

        // Remember the specific client with a certain key
        await this.chatService.registerClient(payload.sub, client);

        // Connect user into a room
        await this.chatService.joinRooms(payload, client);

      } else {
        console.log(`Error : payload not exist`);
        client.disconnect();
      };

    } catch (error) {
      console.log(`Error : ${error}`);
      client.disconnect();
    }
  }
  
  async handleDisconnect(client: Socket) {
    const participant = await client.data.user;
    
    if (participant) {
      await this.chatService.removeClient(participant.sub, client);
    };
    
    console.log(`User: ${participant} disconnected`);
    return `User: ${participant} disconnected`;
  }


  // Connect socket
  @SubscribeMessage('sendMessage')
  @UseInterceptors(WebSocketTransaction)
  @UseGuards(RateLimitGuard)
  @UseGuards(RBACguard)
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateChatDto,
    @WebSocketQueryRunner() queryRunner: QueryRunner,
  ) {
    const payload = client.data.user;
    await this.chatService.sendMessage(payload, dto, queryRunner);
  }
}
