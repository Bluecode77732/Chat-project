import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { logger } from 'src/base/logger/logger';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

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
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    const url = new URL(redisUrl);
    const isTls = url.protocol === 'rediss:';
    const redisConfig = {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
      ...(isTls ? { tls: {} } : {}),
    };
    const pubClient = new Redis(redisConfig);
    const subClient = pubClient.duplicate();
    server.adapter(createAdapter(pubClient, subClient));
    this.chatService.setServer(server);
  }

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
      await this.chatService.removeClient(participant.sub, client.id);
    }

    return `User: ${participant} disconnected`;
  }
}
