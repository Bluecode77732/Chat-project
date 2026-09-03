import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import { logger } from './base/logger/logger';
import { AllExceptionsFilter } from './base/filter/all-exceptions.filter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 나중에 주입하지 않고 여기서 바로 넘김 — AppModule 자체 provider가 생기기 전의
    // bootstrap 실패도 로깅되도록.
    logger: WinstonModule.createLogger(logger),
  });

  // 이거 없으면 OnModuleDestroy 훅(PubSubService, SessionCacheService,
  // ChatGateway)이 SIGTERM/SIGINT에서 실행되지 않음 — 배포할 때마다 Redis
  // 연결이 정상 종료되지 않고 강제로 끊김.
  app.enableShutdownHooks();

  // Railway가 리버스 프록시로 앞단에 있음 — 이거 없으면 모든 요청의 req.ip가 프록시
  // 자체 주소로 잡혀서 AuthRateLimitGuard의 클라이언트별 IP 버킷이 하나로 합쳐짐.
  // '1'은 X-Forwarded-For 체인 전체가 아니라 바로 앞 hop 하나만 신뢰.
  app.set('trust proxy', 1);

  app.use(cookieParser());
  // CSP는 생략: 이 백엔드는 HTML을 거의 서빙하지 않음(REST/GraphQL은 JSON 전용)이라
  // 여기 CSP 헤더는 어차피 inline script 예외가 필요한 Swagger UI(/document)만
  // 보호하게 됨. 실제 XSS 위험 표면(frontend/admin의 렌더링 페이지)은 별도
  // origin이라 이 헤더가 닿지도 않음.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.useGlobalFilters(new AllExceptionsFilter());

  // Express 기본 body limit(100kb)은 base64 인코딩된 프로필 이미지(원본 2MB 상한
  // 기준 약 2.8MB)보다 훨씬 작음 — 그만큼 올려줌.
  app.useBodyParser('json', { limit: '3mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '3mb' });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    // 콤마로 구분: 메인 frontend와 admin 대시보드가 서로 다른 origin의
    // 별도 배포이기 때문.
    origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'apollo-require-preflight',
    ],
  });

  const config = new DocumentBuilder()
    .setTitle('Chat API')
    .setDescription(
      [
        'REST API for the Chat application (auth, user and audit-log management).',
        'Real-time chat itself runs over GraphQL subscriptions and Socket.IO and is not documented here.',
        '',
        'Getting started: use the Authentication API — register, then sign in with Basic auth to obtain an access token, and authorize with it (Bearer) to call the protected endpoints.',
      ].join('\n'),
    )
    .setVersion('1.0')
    // Basic auth: register/signin은 Authorization 헤더에 email:password를 실어보냄.
    .addBasicAuth()
    // Bearer auth: 보호된 엔드포인트는 JWT access token을 기대함.
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    // Cookie auth: token/refreshaccess는 httpOnly refreshToken 쿠키를 읽음.
    .addCookieAuth('refreshToken')
    .addTag('Authentication API', 'Register, sign in/out and token refresh')
    .addTag('User API', 'User CRUD, role management and force-logout')
    .addTag('Audit Log API', 'Audit trail of privileged actions (admin only)')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('document', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Loopback 전용은 순수 `pnpm start:dev`(NODE_ENV=development, RUNTIME_ENV
  // unset/native)에만 적용 — 컨테이너 없는 순수 로컬 dev. docker-compose도 이제
  // NODE_ENV=development를 설정하지만(ADR 0022 참고) 추가로 RUNTIME_ENV=docker를
  // 설정하므로 이 분기는 0.0.0.0으로 유지되어 컨테이너의 매핑된 포트가 계속 열려있음.
  // Railway는 RUNTIME_ENV를 설정하지 않으므로 NODE_ENV=production 경로는 원래도
  // 0.0.0.0이라 영향 없음.
  const host =
    process.env.NODE_ENV === 'development' &&
    process.env.RUNTIME_ENV !== 'docker'
      ? '127.0.0.1'
      : '0.0.0.0';
  await app.listen(process.env.PORT ?? 3000, host);
  logger.info(`Server running on ${host}:${process.env.PORT ?? 3000}`);
}
bootstrap().catch((err: Error) =>
  logger.error(`Bootstrap failed: ${err.message}\n${err.stack ?? ''}`),
);
