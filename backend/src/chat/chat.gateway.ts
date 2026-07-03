import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { OnApplicationShutdown } from '@nestjs/common';
import { ChatService } from './chat.service';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { logger } from 'src/base/logger/logger';
import { Payload } from 'src/auth/interface/payload.interface';
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
      const allowed = (process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      callback(null, !origin || allowed.includes(origin));
    },
    credentials: true,
  },
})
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnApplicationShutdown
{
  private pubClient?: Redis;
  private subClient?: Redis;

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
    this.pubClient = new Redis(redisConfig);
    this.subClient = this.pubClient.duplicate();
    server.adapter(createAdapter(this.pubClient, this.subClient));
    this.chatService.setServer(server);
  }

  // OnModuleDestroy runs before dispose() closes the Socket.IO server, so quitting
  // here would race @socket.io/redis-adapter's own unsubscribe commands on server
  // close (confirmed by reading the installed socket.io/@nestjs/core source).
  // OnApplicationShutdown runs after dispose(), so the adapter's server-close
  // cleanup has already fired before these clients are quit.
  async onApplicationShutdown() {
    try {
      await Promise.all([this.pubClient?.quit(), this.subClient?.quit()]);
    } catch (err) {
      logger.error(
        `ChatGateway Redis adapter shutdown error: ${(err as Error).message}`,
      );
      throw err;
    }
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
        // socket.data is typed as any by socket.io; we narrow it to the shape we control
        (client.data as { user?: Payload }).user = payload;

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
    // socket.data is typed as any by socket.io; we narrow it to the shape we set in handleConnection
    const participant = (client.data as { user?: Payload }).user;

    if (participant) {
      await this.chatService.removeClient(participant.sub, client.id);
    }

    return `User: ${participant?.sub ?? 'unknown'} disconnected`;
  }
}
