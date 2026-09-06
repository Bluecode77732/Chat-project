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
import { ModerationService } from 'src/moderation/moderation.service';

@WebSocketGateway({
  cors: {
    // process.env.CORS_ORIGIN은 데코레이터 적용 시점(ConfigModule 로드 전)엔 undefined —
    // 콜백을 사용해 값이 준비되는 연결 시점까지 평가를 지연.
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
    private readonly moderationService: ModerationService,
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

  // OnModuleDestroy는 dispose()가 Socket.IO 서버를 닫기 전에 실행되므로, 여기서 quit()하면
  // 서버 종료 시 @socket.io/redis-adapter 자체의 unsubscribe 커맨드와 경합함(설치된
  // socket.io/@nestjs/core 소스 확인으로 검증). OnApplicationShutdown은 dispose() 이후
  // 실행되므로, 이 클라이언트들을 quit()할 때는 이미 adapter의 서버 종료 cleanup이 끝난 상태.
  async onApplicationShutdown() {
    try {
      await Promise.all([this.pubClient?.quit(), this.subClient?.quit()]);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      logger.error(`ChatGateway Redis adapter shutdown error: ${errMessage}`);
      throw err;
    }
  }

  async handleConnection(client: Socket) {
    try {
      const rawToken = client.handshake.headers?.authorization;

      // Bearer token의 payload
      const payload = await this.authService.parseBearerToken(
        String(rawToken),
        false,
      );

      if (payload) {
        // Ban 게이트(소켓 레벨): handshake는 여전히 유효한 JWT를 사용하므로, jwt.strategy가
        // HTTP/GraphQL에서 하듯 여기서도 banned user를 거부. client.data.user를 설정하지 않고
        // registerClient도 호출하지 않아 handleDisconnect가 대칭 유지(정리할 것이 없음).
        if (await this.moderationService.isUserBanned(payload.sub)) {
          logger.warn(
            `WebSocket connection rejected (banned user=${payload.sub})`,
          );
          client.disconnect();
          return;
        }

        // socket.data는 socket.io에서 any로 타입 지정됨 — 우리가 제어하는 형태로 narrowing.
        (client.data as { user?: Payload }).user = payload;

        // 특정 key로 이 client를 기억
        await this.chatService.registerClient(payload.sub, client);

        // 사용자를 room에 연결
        await this.chatService.joinRooms(payload, client);
      } else {
        client.disconnect();
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        `WebSocket connection rejected (client=${client.id}): ${errMessage}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    // socket.data는 socket.io에서 any로 타입 지정됨 — handleConnection에서 설정한 형태로 narrowing.
    const participant = (client.data as { user?: Payload }).user;

    if (participant) {
      await this.chatService.removeClient(participant.sub, client.id);
    }

    return `User: ${participant?.sub ?? 'unknown'} disconnected`;
  }
}
