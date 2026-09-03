import { Logger, Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user/entities/user.entity';
import { ChatEntity } from './chat/entities/chat.entity';
import { RoomEntity } from './chat/entities/room.entity';
import { EntityBase } from './base/entity/base.entity';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'node:path';
import { ModerationModule } from './moderation/moderation.module';
import { HealthModule } from './health/health.module';
import { SentryModule } from '@sentry/nestjs/setup';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        ENV: Joi.string().valid('dev', 'prod').required(),
        DB_TYPE: Joi.string().valid('postgres').required(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
        HASH_ROUNDS: Joi.number().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
        ACCESS_TOKEN_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET_EXPIRES_IN: Joi.number().required(),
        ACCESS_TOKEN_SECRET_EXPIRES_IN: Joi.number().required(),
        // 공백만 있는 문자열은 .required()를 통과하지만 허용 origin이 비게 되므로 pattern(/\S/)으로 막음.
        CORS_ORIGIN: Joi.string().pattern(/\S/).required(),
        GEMINI_API_KEY: Joi.string().required(),
        // Redis 연결 문자열 — RedisModule과 PubSubService가 필요로 함
        REDIS_URL: Joi.string().required(),
        USER_CACHE_TTL_SEC: Joi.number().required(),
        SESSION_TTL_SEC: Joi.number().required(),
        MESSAGE_CACHE_TTL_SEC: Joi.number().required(),
        // 관리자 수 상한 — 선택값; 비어있으면 UserService.updateRole이 5로 기본 적용
        MAX_ADMIN_COUNT: Joi.number().optional(),
        // 인증 레이트리밋 — 선택값; 비어있으면 AuthRateLimitGuard가 60초/10회로 기본 적용
        // CI e2e는 연속된 register/signin 요청이 가드에 걸리지 않도록 이 값들을 완화해서 오버라이드
        AUTH_RATE_LIMIT_WINDOW_SEC: Joi.number().optional(),
        AUTH_RATE_LIMIT_MAX_ATTEMPTS: Joi.number().optional(),
        // 모더레이션 임계값/기간 — 전부 선택값; 비어있으면 ModerationService가 MODERATION_DEFAULTS로 대체
        MODERATION_STRIKE_WINDOW_SEC: Joi.number().optional(),
        MODERATION_WARN_THRESHOLD: Joi.number().optional(),
        MODERATION_MUTE_THRESHOLD: Joi.number().optional(),
        MODERATION_MUTE_DURATION_SEC: Joi.number().optional(),
        MODERATION_BAN_THRESHOLD: Joi.number().optional(),
        MODERATION_BAN_DURATION_SEC: Joi.number().optional(),
        MODERATION_DUP_WINDOW_SEC: Joi.number().optional(),
        MODERATION_DUP_THRESHOLD: Joi.number().optional(),
        // 메일(SMTP) — 선택값; 비어있으면 역할 변경 이메일 발송을 건너뜀
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().optional(),
        SMTP_USER: Joi.string().optional(),
        SMTP_PASS: Joi.string().optional(),
        MAIL_FROM: Joi.string().optional(),
        // Sentry 에러 트래킹 — 선택값; 비어있으면 captureException이 아무 동작도 하지 않음
        SENTRY_DSN: Joi.string().optional(),
      }),
      isGlobal: true,
      envFilePath:
        process.env.RUNTIME_ENV === 'docker'
          ? '.env.docker'
          : process.env.NODE_ENV === 'production'
            ? '.env.production'
            : '.env',
    }),
    SentryModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: configService.get<string>('DB_TYPE') as 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [EntityBase, UserEntity, ChatEntity, RoomEntity],
        // 개발 환경 포함 항상 false — 스키마 변경은 마이그레이션으로만 진행 (CLAUDE.md Never Do Group 2 참고).
        synchronize: false,
        migrations: ['dist/migrations/*.js'],
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      subscriptions: {
        'graphql-ws': {
          onConnect: (context) => {
            const token = context.connectionParams?.authorization;

            context.extra = { authorization: token };
            return { authorization: token };
          },
        },
      },
      context: ({
        req,
        extra,
      }: {
        req?: import('express').Request;
        extra?: { authorization?: string };
      }) => {
        // 구독은 Authorization 헤더 대신 connectionParams로 JWT를 전달하므로,
        // GraphQLAuthGuard와 REST 가드가 기대하는 { req: { headers: { authorization } } } 모양으로 맞춰줌.
        if (req) {
          return { req };
        }

        return {
          req: {
            headers: {
              authorization: extra?.authorization,
            },
          },
        };
      },
      playground: false,
    }),
    UserModule,
    ChatModule,
    AuthModule,
    AiModule,
    ModerationModule,
    HealthModule,
  ],
  providers: [Logger],
})
export class AppModule {}
