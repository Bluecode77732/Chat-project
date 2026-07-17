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

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        ENV: Joi.string().valid('dev', 'prod').required(),
        // DB_TYPE prevents wrong connection by DB type
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
        // Validating CORS env via Joi
        // pattern(/\S/) rejects whitespace-only strings that satisfy .required() but produce an empty allowlist.
        CORS_ORIGIN: Joi.string().pattern(/\S/).required(),
        GEMINI_API_KEY: Joi.string().required(),
        // Redis connection string — required by RedisModule and PubSubService
        REDIS_URL: Joi.string().required(),
        USER_CACHE_TTL_SEC: Joi.number().required(),
        SESSION_TTL_SEC: Joi.number().required(),
        MESSAGE_CACHE_TTL_SEC: Joi.number().required(),
        // Moderation thresholds/durations — all optional; ModerationService falls back to MODERATION_DEFAULTS.
        MODERATION_STRIKE_WINDOW_SEC: Joi.number().optional(),
        MODERATION_WARN_THRESHOLD: Joi.number().optional(),
        MODERATION_MUTE_THRESHOLD: Joi.number().optional(),
        MODERATION_MUTE_DURATION_SEC: Joi.number().optional(),
        MODERATION_BAN_THRESHOLD: Joi.number().optional(),
        MODERATION_BAN_DURATION_SEC: Joi.number().optional(),
        MODERATION_DUP_WINDOW_SEC: Joi.number().optional(),
        MODERATION_DUP_THRESHOLD: Joi.number().optional(),
        // Mail (SMTP) is optional — role-change emails are skipped if unset
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().optional(),
        SMTP_USER: Joi.string().optional(),
        SMTP_PASS: Joi.string().optional(),
        MAIL_FROM: Joi.string().optional(),
      }),
      // Configuration global adoption
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? '.env.production'
          : process.env.NODE_ENV === 'docker'
            ? '.env.local'
            : '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: configService.get<string>('DB_TYPE') as 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [EntityBase, UserEntity, ChatEntity, RoomEntity],
        //! WARNING: Set synchronize: `false` in Production to prevent losing data.
        //! Important: Set it `true` to do migration to create DB during Development.
        synchronize: false,
        migrations: ['dist/migrations/*.js'],
        autoLoadEntities: true,
      }),
      // It tells IOC container what dependency injection to be injected with.
      inject: [ConfigService],
    }),
    // Configure GraphQL with the forRoot() static method.
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
        // Returns HTTP request
        if (req) {
          return { req };
        }

        // Returns Subscription WebSocket
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
