import { Logger, Module, UnauthorizedException } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi'
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user/entities/user.entity';
import { ChatEntity } from './chat/entities/chat.entity';
import { RoomEntity } from './chat/entities/room.entity';
import { EntityBase } from './base/entity/base.entity';
import { RedisModule } from './redis/redis.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'node:path';
import { ChatResolver } from './chat/chat.resolver';

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
      }),
      // Configuration global adoption
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: configService.get<string>("DB_TYPE") as "postgres",
        host: configService.get<string>("DB_HOST"),
        port: configService.get<number>("DB_PORT"),
        username: configService.get<string>("DB_USERNAME"),
        password: configService.get<string>("DB_PASSWORD"),
        database: configService.get<string>("DB_DATABASE"),
        entities: [
          EntityBase,
          UserEntity,
          ChatEntity,
          RoomEntity,
        ],
        //! WARNING: Set synchronize: `false` in Production to prevent losing data.
        //! Important: Set it `true` to do migration to create DB during Development.
        synchronize: true,
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
        "graphql-ws": {
          onConnect: (context) => {
            console.log('WebSocket connectionParams:', context.connectionParams);
            const token = context.connectionParams?.authorization;
            console.log('Token:', token);
            context.extra = { authorization: token };
            return { authorization: token };
          },
        },
      },
      context: ({ req, extra, connection }) => {
        console.log('Context extra:', extra);
        console.log('Context connection:', connection);
        // Returns HTTP request
        if (req) {
          return { req };
        };
        const auth = extra?.authorization || connection?.context?.authorization;
        console.log('Final auth:', auth);
        // Returns Subscription WebSocket
        return {
          req: {
            headers: { 
              authorization: extra?.authorization 
            },
          },
        };
      },
      playground: false,
    }),
    UserModule,
    ChatModule,
    AuthModule,
    // RedisModule,
  ],
  providers: [Logger, ChatResolver],
})
export class AppModule { }
