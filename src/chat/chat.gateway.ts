import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { WebSocketTransaction } from './interceptor/ws.transaction.interceptor';
// import type { QueryRunner } from 'typeorm';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { WebSocketQueryRunner } from './decorator/ws-query-runner.decorator';
import { RateLimitGuard } from './guard/rate-limit.guard';


@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Todo: GraphQL connection
  @WebSocketServer()
  server: Server;
  
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) { }

  async handleConnection(client: Socket) {
    console.log('🔌 Connection attempt');
    try {
      // Bearer ir3j9rkdokaods
      const rawToken = client.handshake.headers.authorization;
      console.log('🔍 Token received:', !!rawToken);

      // Bearer token payload
      const payload = await this.authService.parseBearerToken(String(rawToken), false);
      console.log('🔍 Payload:', payload);

      if (payload) {
        // Put bearer token into data.user to be extracted by 
        client.data.user = payload;

        // console.log(`Succeed : Connected, payload on data.user`);

        // const userId = Number(payload.sub);           // enforce number
        // console.log("Registering user ID type:", typeof userId, userId);

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
    // This is fun when disconnected lol
    // throw new Error('Method not implemented.');
  }


  // Connect socket
  @SubscribeMessage('sendMessage')
  @UseInterceptors(WebSocketTransaction)
  @UseGuards(RateLimitGuard)
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateChatDto,
  ) {
    const payload = client.data.user;
    await this.chatService.sendMessage(payload, dto, this.server);
  }


  // @Get(':id')
  // async getUserConversation(@Param('id') userId: number) {
  //   return await this.chatService.getUserConversation(userId);
  // }


  // @SubscribeMessage('send')
  // async sendMessage(
  //   @MessageBody() data: { msg: string },
  //   @ConnectedSocket() client: Socket,
  // ) {
  //   client.emit("send message", { ...data, from: "server" });
  // };

  // @SubscribeMessage('receive')
  // async receiveMessage(
  //   @MessageBody() data: { msg: string },
  //   @ConnectedSocket() client: Socket,
  // ) {
  //   console.log("receive sent.");
  //   console.log(data);
  //   console.log(client);
  // };
}
