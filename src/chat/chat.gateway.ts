import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { UseInterceptors } from '@nestjs/common';
import { WebSocketTransaction } from './interceptor/itc.ws.transaction';
import type { QueryRunner } from 'typeorm';
import { CreateChatDto } from './entities/dto/create-chat.dto';
import { WebSocketQueryRunner } from './decorator/dec.ws-query-runner';

@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) { }

  async handleConnection(client: Socket) {
    try {
      // Bearer ir3j9rkdokaods
      const rawToken = client.handshake.headers.authorization;

      // Bearer token payload
      const payload = await this.authService.parseBearerToken(String(rawToken), false);

      if (payload) {
        // Put bearer token into data.user to be extracted by 
        client.data.user = payload;

        console.log(`Succeed : Connected, payload on data.user`);

        // Remember the specific client with a certain key
        this.chatService.registerClient(payload.sub, client);

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
    const user = await client.data.user;

    if (user) {
      this.chatService.removeClient(user.sub);
    }

    // throw new Error('Method not implemented.');
  }


  // Connect socket
  @SubscribeMessage('sendMsg')
  @UseInterceptors(WebSocketTransaction)
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateChatDto,
    @WebSocketQueryRunner() qr: QueryRunner,
  ) {
    const payload = client.data.user;
    await this.chatService.createMessage(payload, dto, qr);
  }


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
