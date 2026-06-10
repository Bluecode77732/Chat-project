import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { logger } from 'src/base/logger/logger';

@WebSocketGateway({
  cors: {
    // process.env.CORS_ORIGIN is undefined at decoration time (before ConfigModule loads).
    // Using a callback defers evaluation to connection time, when the value is available.
    origin: (
      origin: string,
      callback: (err: Error | null, allow: boolean) => void,
    ) => {
      callback(null, !origin || origin === process.env.CORS_ORIGIN);
    },
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Bearer ir3j9rkdokaods
      const rawToken = client.handshake.headers?.authorization;
      // const rawToken = client.handshake.headers?.authorization || client.handshake.auth?.token || client.handshake.query?.token;

      // Bearer token payload
      const payload = await this.authService.parseBearerToken(
        String(rawToken),
        false,
      );

      if (payload) {
        // Put bearer token into data.user to be extracted by
        client.data.user = payload;

        // Remember the specific client with a certain key
        await this.chatService.registerClient(payload.sub, client);

        // Connect user into a room
        await this.chatService.joinRooms(payload, client);
      } else {
        client.disconnect();
      }
    } catch (error) {
      logger.warn(
        `WebSocket connection rejected (client=${client.id}): ${(error as Error).message}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const participant = client.data.user;

    if (participant) {
      await this.chatService.removeClient(participant.sub, client);
    }

    return `User: ${participant} disconnected`;
  }
}
