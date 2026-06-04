![NestJS](https://img.shields.io/badge/NestJS-E0234E)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101)
![Redis](https://img.shields.io/badge/Redis-DC382D)
![GraphQL](https://img.shields.io/badge/GraphQL-E10098)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6)
![Jest](https://img.shields.io/badge/Jest-C21325)
![Docker](https://img.shields.io/badge/Docker-2496ED)
![React](https://img.shields.io/badge/React-61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF)
![Vercel](https://img.shields.io/badge/Vercel-000000)
![Gemini](https://img.shields.io/badge/Gemini-8E75B2)

> English version: [README.md](README.md)

# 실시간 채팅 애플리케이션
- 인증된 사용자들이 서로 채팅할 수 있는 클래식한 개인 1:1 채팅 서버 관리 애플리케이션입니다.
- 이 프로젝트는 Socket.IO를 통한 두 엔티티 간 통신, Redis를 이용한 캐싱과 속도 제한, 세션 유지, 서버에 채팅 로그 저장 방식을 이해하기 위한 학습 목적으로 제작되었습니다.


## 개요
실시간 1:1 채팅을 가능하게 하는 개인 채팅 프로젝트입니다.
- 인증: Passport 전략을 활용한 JWT 기반 인증
- 채팅 관리: 트랜잭션 안전성을 갖춘 Socket과 Redis 세션 및 캐시 연동
- API 문서: Swagger 연동 + Altair & GraphQL
- 테스트: 핵심 로직 약 +90% 커버리지의 유닛 테스트


## 프로젝트 동기
- Socket.IO 인메모리 저장소, Redis 세션 및 캐시를 활용한 채팅 구현 이해
- Basic, Bearer, JWT를 활용한 사용자 인증 및 권한 부여 이해
- 읽기 쉽고 견고한 프로그래밍을 위한 'KISS'(Keep It Simple Solid), 'YAGNI'(You Are Not Gonna Need It) 원칙 준수
- 1:1 개인 채팅 통신의 기술적 지식 습득


## 라이브 데모
- 프론트엔드: https://chat-project-frontend-ten.vercel.app
- REST API: https://chat-project-production-3b22.up.railway.app
- WebSocket: wss://chat-project-production-3b22.up.railway.app


## 빠른 시작
- 사전 요구사항
  - Node.js >= v24.xx
  - Nest.js >= v11.xx
  - PostgreSQL >= v17.xx
  - pnpm (권장) 또는 npm >= v10.xx
  - Docker >= v28.xx

```md
  # 의존성 설치
  ```powershell
  pnpm install
  ```
  
  # 환경 설정
  `backend/.env`로 복사 후 자격증명을 입력합니다.
  ```powershell
  cp backend/.env.example backend/.env
  ```
 
  # 데이터베이스 수동 생성
  자동 DB 생성을 위해 'backend/src/app.module.ts'에서 'synchronize: true'로 설정합니다.

  # 마이그레이션 스키마 설정
  스키마 변경사항 기록을 위해 'backend/src/app.module.ts'에서 'synchronize: false'로 설정합니다.
  ```powershell
  cd backend
  pnpm migration:generate -- src/migrations/MigrationName
  pnpm build
  pnpm migration:run
  ```

  # Docker로 Redis 실행
  ```powershell
  docker start redis-chat
  ```

  # 개발 서버 실행 (backend 디렉토리에서 실행)
  ```powershell
  cd backend && pnpm start:dev
  ```
  
  # 로컬 소켓 채팅 테스트
  # Postman Socket 사용 (권장)
  # 방법 A:
  1. Postman에서 Socket.IO 탭 두 개를 열고, URL에 `ws://localhost:3000`을 입력합니다.
  2. 회원가입 후 로그인하여 액세스 토큰을 발급받습니다.
  3. 통신하려는 각 탭의 Headers에서 key를 'authorization', value를 'Bearer token'으로 입력합니다.
  4. 두 탭을 모두 연결하고 터미널 또는 `logs.log` 파일에서 참여한 방의 "recipientId"를 확인합니다.
  5. Message 탭에서 JSON 형식으로 "message", "recipientId"를 입력하고 각 탭의 Message 필드에 값을 채웁니다.
  6. 두 탭 모두 Message 필드 하단에 'sendMessage'를 설정한 후 메시지를 전송합니다.

  # Altair와 Postman 사용
  # 방법 B:
  아래 **API 문서**, **주요 엔드포인트**, **채팅** 섹션을 참고하세요.

  # 전체 테스트 실행
  pnpm test

  # 테스트 커버리지 실행 (backend 디렉토리에서 실행)
  cd backend && pnpm test:cov
  
  # Swagger UI 접속
  http://localhost:3000/document
```md


### 문제 해결
프로그램 실행 시 발생하는 문제 목록입니다.
- Redis 연결 문제
  - 로그: "GraphQLModule dependencies initialized"
  - 로그: "Redis Error: AggregateError [ECONNREFUSED]"
  - 로그: "Error: connect ECONNREFUSED ::IPv6 주소:포트"
  
  - 해결책 
    - ✅ 터미널에서 `docker start redis-chat` 실행

- 연결 실패
  - 로그: "Failed to send message: Sender isn't online"
  - 로그: "Failed to send message: Cannot Find Sender ID"

  - 해결책 
    - ✅ 서버가 HTTP 또는 TCP 소켓을 통해 헤더에서 올바른 경로로 요청을 찾지 못하는 경우가 많습니다. 요청이 사용자 id 또는 sub 형태로 전달되지 않는 경우, 요청 경로를 수정한 'Guard' 또는 'Decorator'를 확인해야 합니다.


- DB에 메시지 저장 실패

  - 해결책 
    - ✅ 메시지를 저장하는 'service' 또는 'resolver' 파일에서 트랜잭션 요소인 `commitTransaction()`, `rollbackTransaction()`, `release()`가 구현되어 있는지 확인하세요.


## API 문서
### Swagger UI
***모든 기능을 테스트하려면 먼저 회원가입을 해야 합니다.***
Altair는 Mutation 테스트가 불가하고, Postman은 Subscription 테스트가 불가하기 때문에, 두 플랫폼이 각각 역할을 분담하여 채팅 통신을 완전하게 테스트합니다.

### 주요 엔드포인트
**Swagger**
아래 URL에서 'Auth' 및 'User' 엔드포인트를 테스트하세요.
- URL: `http://localhost:3000/document`

**인증**
- `POST /auth/register` - Basic Auth로 회원가입
- `POST /auth/signin` - JWT 토큰 발급
- `POST /auth/token/refreshaccess` - 액세스 토큰 갱신

**사용자**
- `GET /user` - 전체 사용자 조회
- `GET /user/:id` - 특정 사용자 조회
- `POST /user` - 사용자 생성
- `PATCH /user/:id` - 사용자 수정
- `DELETE /user/:id` - 사용자 삭제

**채팅**
- Socket.IO
  ***탭 1***
  - URL: `ws://localhost:3000`
  - 설명: Postman에서 Socket.IO 탭 두 개를 열고 메시지를 전송합니다.
  - 요청 핸들러
    - 기본 요청 핸들러: Socket.IO
    - Headers
      - key : authorization; value: Bearer token
    - Events: SendMessage(Listen: ON), CreateRoom(Listen: ON)
  - 메시지
    ```json
    {
      "message": "참여자 1이 2에게 보내는 메시지",
      "recipientId": 2
    }
    ```

  ***탭 2***
  - URL: `ws://localhost:3000`
  - 설명: Postman에서 Socket.IO 탭 두 개를 열고 메시지를 전송합니다.
  - 요청 핸들러
    - 기본 요청 핸들러: Socket.IO
    - Headers
      - key : authorization; value: Bearer token
    - Events: SendMessage(Listen: ON), CreateRoom(Listen: ON)
  - 메시지
    ```json
    {
      "message": "참여자 2가 1에게 보내는 메시지",
      "recipientId": 1
    }
    ```


- Altair (구독)
  - URL: POST `http://localhost:3000/graphql`
  - 설명: 이 플랫폼은 대체 가능합니다. Altair에서 탭을 열고 아래와 같이 요청 핸들러를 설정한 후 GraphQL에 연결합니다. 연결에 성공하면 GraphQL로 메시지를 전송할 때 수신자로서 채팅 통신을 테스트할 수 있습니다.

  - 요청 핸들러
    - 기본 요청 핸들러: HTTP
    - Parameters (JSON): {}
    - Subscription URL: http://localhost:3000/graphql
    - Use default request handler for subscription: off
    - Subscription type: WebSocket (graphql-ws)
    - Connection Parameters (JSON): { "authorization": "Bearer token" }
  - 쿼리
    ```altair
    subscription {
      receiveMessage(roomId: "19") {   
        id
        message
        participant {
          id
        }
      }
    }
    ```
  - 변수
    ```altair
    {}
    ```


- GraphQL (뮤테이션)
  - URL: `http://localhost:3000/graphql`
  - 설명: 이 플랫폼은 대체 불가합니다. Postman에서 GraphQL 탭을 열고 아래와 같이 사전 요구사항을 설정한 후 Altair에 연결합니다. 모두 설정되면 발신자로서 채팅 통신을 테스트할 준비가 완료됩니다.

  - 요청 핸들러
    - Headers: authorization: Bearer token
  - 쿼리
    ```graphql
    mutation SendMessage($input: CreateChatInput!, $recipientId: Int!) {
        sendMessage(input: $input, recipientId: $recipientId) {
            id
            message
            participant {
              id
            }
            roomId
            createdAt
        }
    }
    ```
  - 변수
    ```graphql
    {
      "input": {
        "message": "Postman에서 전송",
        "recipientId": 2,
        "room": 19
      },
      "recipientId": 2
    }
    ```


## 기술 스택
### 프론트엔드
백엔드와의 엔드투엔드 통합을 보여주는 최소화된 React + TypeScript 클라이언트입니다.

- 스택: React, TypeScript, Vite, Tailwind CSS, Zustand, Apollo Client, Socket.IO Client ✔
- 인증: JWT를 메모리(Zustand)에 저장, 리프레시 토큰은 localStorage에 유지 ✔
- 실시간: Socket.IO로 연결/방 관리, GraphQL Mutation/Subscription으로 메시지 처리 ✔
- 보안: DOMPurify를 통한 XSS 방지, CORS 준수 요청, 보호된 페이지를 위한 Route Guard ✔
- 배포: Vercel (푸시 시 자동 배포) ✔

### 백엔드
- 언어: TypeScript — 타입 안전하고 견고한 객체 지향 언어, JavaScript의 슈퍼셋. ✔
- 런타임: Node.js — Chrome V8 엔진으로 구축된 JavaScript 런타임, 애플리케이션이 원활하게 실행되는 생태계 제공. ✔
- 프레임워크: Nest.js — TypeScript 프로젝트를 위한 확장 가능한 프레임워크, 지속적으로 성장하는 강력한 프레임워크. ✔
- 아키텍처: 모놀리식 아키텍처 — 일반적인 프로젝트에 적합하고 컴포넌트 단위 결합 및 분리가 용이한 원칙. ✔
- 소켓: Socket.IO — NestJS 공식 문서에 기재된 것처럼, 이 미들웨어 패키지는 POST 메서드를 통한 HTTP 요청으로 multipart/form-data 형식을 처리하는 방법을 제공하여 애플리케이션이 쉽게 처리할 수 있게 합니다. ✔
- AI: Google Gemini 2.5 Flash — 선택 가능한 성격을 통한 AI 채팅 응답 ✔
- 인증: JWT 인증 — 애플리케이션 사용을 위한 사용자 유효성 검증 ✔
- 가드: 유효한 데이터 타입만 허용 ✔
- 인터셉터: 사용자 데이터를 조작하는 미들웨어 ✔
- 역할 기반 접근: 권한 클래스로 사용자 레벨 구분 ✔
- 채팅: 주요 웹소켓 구현 ✔
- 캐시: Redis — 메시지 속도 제한 및 사용자 데이터의 효율적인 저장. ✔
- 필터: 예외 핸들러 ✔
- 로거: 애플리케이션 실행 중 이벤트, 오류, 디버그 정보 기록 ✔
- 유닛 테스트: 각 유닛별 서비스 메서드 테스트 ✔
- Swagger: 각 엔드포인트 테스트를 위한 메서드 기반 문서화 ✔


## 기능
- 실시간 양방향 메시지 전송
- 속도 제한 - 사용자당 분당 10개 메시지
- 서버 재시작 시에도 유지되는 사용자 세션
- 사용자 간 개인 채팅방
- 트랜잭션 안전한 메시지 저장 및 전달
- Redis 기반 세션으로 수평 확장 지원
- Google Gemini 2.5 Flash 기반 AI 채팅 (4가지 성격: 친절한 어시스턴트, 코드 도우미, 영어 선생님, 창의적인 작가)
- 커서 기반 메시지 히스토리 및 무한 스크롤


## 아키텍처
### 하이브리드 저장소 패턴
- Redis(세션/캐시): 일관된 데이터 흐름과 서버 공유를 위해 `userId` => `socketId` 매핑 저장
- 인메모리(소켓): 쉬운 구현과 실시간 통신이 가능한 WebSocket 작업에 필요한 `userId` => `socketId` 객체 저장
- 두 방식을 함께 사용하는 이유: Redis는 직렬화된 객체를 'JSON' 형식으로 저장하는 반면, 소켓은 클라이언트가 TCP 레벨 연결을 통해 연결된 동안에만 저장합니다. 따라서 클라이언트는 세션/캐시 데이터로 재연결할 수 있습니다.

### Redis Pub/Sub
- `RedisPubSub` 싱글톤 (`pubsub.service.ts`): GraphQL 뮤테이션과 활성 구독 간의 브리지 역할. 커밋 후 리졸버가 `receiveMessage :${roomId}` 채널에 발행하면, 연결된 모든 `receiveMessage` 구독자가 실시간으로 메시지를 수신합니다.


## 흐름
프론트엔드는 메시지 전송에 **GraphQL Mutation 경로**를 사용합니다. **Socket.IO 경로**는 직접 WebSocket 클라이언트에서도 사용 가능합니다.

### Socket.IO 경로
1. 클라이언트가 `chat.gateway`의 handleConnection으로 WebSocket 연결
  1.1. JWT 토큰 인증
  1.2. Redis에 `userId` => `socketId` 저장
  1.3. Map에 `socketId` => Socket 저장
  1.4. `joinRooms()`로 사용자를 기존 방에 참여시킴

2. 클라이언트가 `sendMessage` 함수 호출
  2.1. RateLimitGuard: Redis로 `${userId}` 카운터 증가
  2.2. 조건: `count > 10? 'WsException' 발생 : 계속`
  2.3. 사용자의 첫 메시지인 경우 60초 TTL 설정

3. `sendMessage` 처리 과정
  3.1. `sendMessage` 실행
  3.2. QueryRunner 트랜잭션 시작
  3.3. 발신자 및 수신자 존재 여부 확인
  3.4. `findRoom` 또는 `createRoom` 실행
  3.5. 방 외래키와 함께 DB에 'ChatEntity' 저장

4. 발신자 Socket 가져오기
  4.1. Redis: `getUserStatus`로 `socketId` 조회
  4.2. Map: `clientConnection.get(getUserSocketId.socketId)`로 Socket 객체 조회

5. Socket.IO 방에 emit
  5.1. `senderSocketId.to(room.id.toString())`로 `(ChatEntity, messageSchema)`에 `emit('sendMessage')`하여 `room.id`를 통해 방 멤버에게 브로드캐스트
  5.2. `senderSocketId.emit('sendMessage')`로 발신자에게 `(ChatEntity, messageSchema)` 전달 확인

6. `WsTransactionInterceptor` (핸들러 반환 후 실행)
  6.1. `commitTransaction()` — 오류 시 `rollbackTransaction()`
  6.2. `SessionCacheService.cacheMessage()` 커밋 후 캐시 저장

7. 수신자가 발신자의 메시지 수신
  7.1. `joinRooms()`로 이미 사용자가 기존 방에 참여해 있음
  7.2. 클라이언트가 메시지 스키마와 함께 'sendMessage' 수신

8. 클라이언트 연결 해제
  8.1 클라이언트가 `chat.gateway`에서 `handleDisconnect()` 수행하여 소켓 연결 해제
  8.2 클라이언트가 Redis에서 연결 해제 => 상태: 오프라인
  8.3 클라이언트 연결 해제 시 `removeClient`가 `chat.service`에서 `socketId` 항목을 Map에서 삭제

### GraphQL Mutation 경로
1. 클라이언트가 `sendMessage` 뮤테이션 호출
  1.1. `GraphQLAuthGuard` + `RateLimitGuard` 실행
  1.2. 인라인 `QueryRunner` 트랜잭션 시작
  1.3. `ChatService.sendMessage()`로 발신자/수신자 검증, 방 조회 또는 생성, `ChatEntity` 저장
  1.4. `queryRunner.commitTransaction()`

2. 커밋 후 전달
  2.1. `SessionCacheService.cacheMessage()`로 Redis에 메시지 캐싱
  2.2. `PubSubService.publish()`로 `receiveMessage :${roomId}` 채널에 발행
  2.3. `ChatService.broadcastToRoom()`으로 Socket.IO 방에 `'sendMessage'` emit

3. AI 응답 (수신자가 AI 유저인 경우)
  3.1. 응답 반환 후 `setImmediate` 실행
  3.2. `AiService.handleReply()`가 Redis 락 획득, 대화 히스토리 구성, Gemini API 호출
  3.3. AI 응답 DB 저장 → Redis 캐싱 → 방 브로드캐스트 → Pub/Sub 발행

4. 구독자 메시지 수신
  4.1. Redis Pub/Sub이 활성 `receiveMessage(roomId)` 구독자에게 전달
  4.2. GraphQL 구독 리졸버가 페이로드를 클라이언트에 push


## 빌드
### 전체 설치
의존성 (36개)
- @apollo/server
- @as-integrations/express5
- @google/genai
- @nestjs/apollo
- @nestjs/config
- @nestjs/graphql
- @nestjs/jwt
- @nestjs/mapped-types
- @nestjs/passport
- @nestjs/platform-socket.io
- @nestjs/swagger
- @nestjs/throttler
- @nestjs/typeorm
- @nestjs/websockets
- @types/bcrypt
- @types/passport-jwt
- @types/passport-local
- bcrypt
- class-transformer
- class-validator
- graphql
- graphql-redis-subscriptions
- graphql-subscriptions
- graphql-ws
- ioredis
- joi
- nest-winston
- passport
- passport-jwt
- passport-local
- pg
- redis
- socket.io
- socket.io-client
- typeorm
- winston

개발 의존성 (5개)
- @types/supertest
- @types/winston
- supertest
- ts-jest (커스텀 jest 설정)
- source-map-support

controller, core, platform-express, testing, jest, eslint, prettier, ts-node, typescript 등의 NestJS CLI 기본 패키지는 제외.


### 설정
설치가 완료되면 `backend/src/app.module.ts`로 이동하여 패키지 설정을 진행합니다.

패키지
- joi
  - JavaScript 객체 스키마 유효성 검사를 강제하는 내장 유효성 검사기 패키지입니다.
  - `validationSchema`만으로 자동 유효성 검사가 되지 않는 설정 파일을 검증하기 위해 사용합니다.

메서드
- join
  - 'path'가 아닌 'node:path' 사용: 같은 이름의 외부 패키지와의 충돌 방지.
  - 경로 구분자를 사용하여 OS 크로스 플랫폼 호환성을 보장합니다.

```ts
  import * as Joi from 'joi';

  @Module({
    imports: [
      // FYI : 정적 메서드 `forRoot`
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
        CORS_ORIGIN: Joi.string().required(),
        GEMINI_API_KEY: Joi.string().required(),
      }),
      isGlobal: true,
    }),
```


### 환경 변수 설정
`backend/.env` 파일을 생성하고 아래 변수를 붙여넣습니다:
```env.example
  # 개발 환경
  ENV=dev

  # DB 설정
  DB_TYPE=yourDatabase
  DB_HOST=yourDatabase
  DB_PORT=yourPort
  DB_USERNAME=yourDBport
  DB_PASSWORD=yourDBpassword
  DB_DATABASE=yourDBtype

  # 해시
  HASH_ROUNDS=hashRounds

  # 시크릿 토큰
  REFRESH_TOKEN_SECRET=yourEncodedSecretKey
  ACCESS_TOKEN_SECRET=yourEncodedSecretKey

  # 만료 시간
  REFRESH_TOKEN_SECRET_EXPIRES_IN=expiryTime
  ACCESS_TOKEN_SECRET_EXPIRES_IN=expiryTime

  # Redis 설정
  REDIS_URL=redis://user:password@host:port

  # Redis TTL (초)
  USER_CACHE_TTL_SEC=300
  SESSION_TTL_SEC=86400
  MESSAGE_CACHE_TTL_SEC=86400

  # CORS URL 설정
  CORS_ORIGIN=your.vercel.app

  # Google Gemini AI
  GEMINI_API_KEY=your-gemini-key
```


### 채팅
WebSocket
  실시간 양방향 통신 프로토콜로, 웹 브라우저(클라이언트)와 서버 간 연결을 생성합니다.
  동적이고 지연시간이 낮은 경험을 위해 느린 HTTP 폴링을 대체하는 즉각적인 데이터 교환을 위한 지속적인 연결을 생성합니다.

라이프사이클 훅
- OnGatewayConnection
  handleConnection() 메서드 구현을 강제합니다. 라이브러리별 클라이언트 소켓 인스턴스를 인자로 받습니다.
- OnGatewayDisconnect
  handleDisconnect() 메서드 구현을 강제합니다. 라이브러리별 클라이언트 소켓 인스턴스를 인자로 받습니다.


### Docker 
#### 공개 - Dockerfile
무거운 `devDependencies`와 보안 취약점을 줄이기 위해 Multi-Stage 패턴 사용.
- `git push`하면 Dockerfile 모델의 테스트 및 배포 프로세스가 자동으로 진행됩니다.

#### 로컬 - docker-compose
Docker를 통해 모든 서비스 실행

- 프로젝트 루트에 `.env.local` 필요 (`backend/.env.example`에서 복사 후 조정 — `NODE_ENV=docker`)

- 모든 서비스 시작
`docker compose up -d --build`

- 모든 서비스 중단
`docker compose down -v`

- DB 마이그레이션 실행
`docker compose exec chat pnpm migration:run`

- 로그 확인
`docker compose logs -f chat`

- 'chat' 컨테이너 확인
`docker ps`

- 연결 확인
`docker exec -it redis-chat redis-cli ping`


#### 사용법
Redis 시작
`docker start redis-chat`

Redis 중지
`docker stop redis-chat`

컨테이너 제거 (이미지는 유지)
`docker rm redis-chat`


### 인증
두 가지 로그인 엔드포인트 구현.
- Basic 인증
  - 클라이언트는 바이너리 데이터를 안전하게 전송하기 위해 'base64'로 인코딩된 사용자명과 비밀번호를 제출하여 자격증명을 확인합니다.
- 토큰 기반 인증
  - 클라이언트가 로그인하면 JWT(Javascript Web Token) 형태의 토큰을 받고, 서버는 Basic 인증의 자격증명 대신 이 토큰이 포함된 후속 요청에 토큰을 전송합니다. 서버는 토큰을 유효성 검사합니다.


### 사용자
- TypeORM을 통한 기본 CRUD 엔드포인트와 영구 데이터 저장을 가진 일반적인 사용자 관리 서비스.
- 더 쉽고 깔끔한 모듈식 구현을 위한 NestJS 의존성 주입 기법.


### 역할
- 사용자가 bearer 토큰을 발급받으면 raw 토큰이 필요합니다. 역할이 `signedIn`으로 설정되면 역할 정보가 포함된 raw 토큰을 가질 수 있습니다.
- `signedIn` 역할을 가진 사용자만 토큰이 발급되어도 메시지를 보낼 수 있습니다.
- 사용자 역할이 `signedOut`인 경우 아래 로그와 같이 오류가 발생합니다.


### Redis
- 원래는 Redis 없이 인메모리 Socket에 데이터를 저장하지만, Redis를 사용하면 사용자의 메타데이터를 효율적으로 저장하고 서버의 수평적 확장 시 유용합니다.

#### 코드 비교 예시

Socket 인메모리
```ts
  // Redis 이전
  registerClient(participantId: number, client: Socket) {
    this.clientConnection.set(participantId, client);
  };
```

인메모리 포함 Redis
```ts
  // Redis 이후
  async registerClient(participantId: number, client: Socket) {
    await this.redisService.sethUserOnline(participantId, client.id);
    this.clientConnection.set(client.id, client);
  };
```


### AI
Google Gemini 2.5 Flash 기반. `AiModule`에는 두 가지 서비스가 포함됩니다.
- `AiService` — Gemini API 호출, 대화 히스토리 구성(최근 10개 메시지), Redis 분산 락으로 방당 중복 응답 방지
- `AiRoomService` — 방별 성격 선택 및 조회 관리

**성격 목록**
- `FRIENDLY`: 일반 Q&A, 따뜻하고 격려하는 말투
- `CODING`: 프로그래밍 전문, 코드 예시 중심
- `ENGLISH`: 영작 교정 및 자연스러운 표현 제안
- `CREATIVE`: 스토리텔링, 브레인스토밍, 글쓰기 도움

**사용 방법**
1. Conversations 배너에서 **AI Chat** 클릭
2. 첫 메시지 전송 시 성격 선택
3. 변경 시: **성격 변경** 버튼 클릭 (횟수 제한 없음)


### 테스트
테스트 성공률을 확인하기 위해 커버리지 테스트가 적합한 지원 도구입니다.

#### 설정
- 유닛 테스트

테스트 코드는 `spec.ts`에 정의되어 있으며 실행 가능합니다.

테스트 디렉토리를 상대 경로 `src`에서 별도의 루트 `["src"]`로 재배치합니다 ('Package.json' 기준).

배열로 감싸진 디렉토리는 e2e 테스트 등의 추가 테스트 위치를 나중에 추가할 유연성을 제공합니다.

**단일 기본 디렉토리**
```json
"jest": {
  "rootDir": "src",
}
```

**다중 기본 디렉토리**
```json
"jest": {
  "roots": ["src"],
}
```

- 커버리지 경로 제외
`coveragePathIgnorePatterns`에서 테스트하지 않을 항목을 정의합니다 ('Package.json' 기준).
```json
"coveragePathIgnorePatterns": [
  "main.ts",
  "module.ts",
  "dto.ts",
  "entity.ts",
  "decorator.ts",
  "dec.ts",
  "strategy.ts",
  "guard.ts",
  "controller.ts",
  "gateway.ts",
  "interceptor.ts",
  "itc.ts",
  "role.ts",
  "logger.ts",
  "type.ts",
  "pubsub.service.ts",
  "resolver.ts",
  "data-source.ts",
  "migrations",
  "system-prompts.ts",
  "ai-personality.enum.ts"
],
```

- 디렉토리 루트
'Package.json'에서 설정 파일의 상위 디렉토리에 커버리지 보고서 출력 디렉토리를 설정하여 모든 테스트 파일을 한 번에 테스트할 수 있습니다.
  - 하위 저장소
  ```json
    "coverageDirectory": "../coverage",
  ```

  - 상위 저장소
  ```json
    "coverageDirectory": "./coverage",
  ```

- 모듈명 매퍼
'Package.json'에서 정규식을 사용하여 `src/utils`를 `<rootDir>/src/utils`로 변경하는 모듈 임포트 경로 매핑.
```json
"moduleNameMapper": {
  "src/(.*)": "<rootDir>/src/$1"
}
```

#### 테스트 커버리지
**테스트 결과**
- Test Suites: 6 passed, 6 total (auth, chat, user, redis, ai, ai-room)

**커버리지 결과**
- Auth Service: 95.89%
- Chat Service: 91.86%
- Redis Service: 90.9%
- User Service: 73.17% (단순 'Get' 및 'Delete' 메서드 제외)
- AI Service: 100%
- AI Room Service: 100%

**예시 코드**
```ts
  describe('ChatService', () => {
    let chatService: ChatService;
    let userRepository: Repository<UserEntity>;
    
    describe('getOrCreateRoom', () => {
      it('should get a created room', async () => {
        //* 모의 데이터
        const mockSender = {
          id: 1,
          email: 'user1@gmail.com',
          password: 'pw',
          role: 0,
        } as UserEntity;
        const mockRecipientId = 2;
        const mockRecipient = { id: 2 } as UserEntity;
        const mockRooms = { id: 1, participants: [], chats: [] } as RoomEntity;

        jest.spyOn(chatService, 'findRoom').mockResolvedValue(mockRooms);

        const result = await chatService.getOrCreateRoom(
          mockSender,
          mockRecipientId,
          mockQueryRunner as QueryRunner,
        );

        expect(chatService.findRoom).toHaveBeenCalledWith(
          mockSender.id,
          mockRecipient.id,
          mockQueryRunner as QueryRunner,
        );
        expect(result).toEqual(mockRooms);
      });
    }
  });
```


### 배포
#### 프론트엔드 - Vercel
**라이브 데모**
- 라이브 URL: https://chat-project-frontend-ten.vercel.app

**CI/CD 흐름**
`git push origin main` => Vercel 자동 배포

**설정**
- 루트 디렉토리: `frontend/`
- 모노레포 패키지 해석을 위한 `pnpm-workspace.yaml`


#### 공개 - Railway
**라이브 데모**
- 라이브 URL: https://chat-project-production-3b22.up.railway.app

**CI/CD 흐름**
`git push origin main` => GitHub Actions (테스트 => 빌드) => Railway CLI => 자동 배포

**설정 (최초 1회)**
1. GitHub => Settings => Secrets => Actions에 `RAILWAY_TOKEN` 추가
2. Railway Dashboard => Variables 탭에 `.env` 변수 설정
3. Railway에 Redis 플러그인 추가 (로컬 Docker Redis 대체)

**설정 파일**
- '.github/workflows/deploy.yml': 테스트 & 빌드 실행 후 Railway CLI로 배포
- 'railway.toml': Dockerfile로 빌드, 배포 시 `cd backend && pnpm migration:run && node dist/main` 실행


#### 로컬 - Docker
Docker를 사용하여 Redis 서버 배포 및 실행

- Redis 컨테이너 실행
`docker run -d -p 6379:6379 --name redis-chat redis:latest`

- 'redis-chat' 컨테이너 확인
`docker ps`

- Redis 연결 확인
`docker exec -it redis-chat redis-cli ping` => PONG


#### 사용법
Redis 시작
`docker start redis-chat`

Redis 중지
`docker stop redis-chat`

컨테이너 제거 (이미지는 유지)
`docker rm redis-chat`


#### 사용자 데이터 확인

- 터미널 명령어
`docker compose exec redis redis-cli`

- 키 확인
`KEYS user:*`

- 데이터 확인
`HGETALL user:<user_number>`

- 결과
`HGETALL user:1`
1) "socketId"
2) "사용자 연결 ID"
3) "status"
4) "online"

`HGETALL user:2`
1) "socketId"
2) "사용자 연결 ID"
3) "status"
4) "online"


## 디버깅 목록
- service의 잘못된 TypeORM 쿼리
- 엔티티 스키마와 일치하지 않는 속성명
- 메시지가 DB에 표시되지 않는 `commitTransaction()` 누락
- 메시지 전송 시마다 새로운 방이 반복 생성됨
- 프론트엔드에서 잘못된 recipient ID 전송
- 발신자 ID 조회 실패


## 향후 확장 계획
- 백엔드: 사용자별 대화 목록 저장 (마지막 메시지, 읽지 않은 메시지 수 등)
- 백엔드: `roomId`로 브로드캐스트하여 그룹 채팅 생성 또는 `Redis Pub/Sub` 패키지로 알림 기능 확장
- 백엔드: 사용자가 방과 대화를 삭제할 수 있는 기능
- 백엔드: 한쪽이 메시지를 입력 중일 때 "입력 중..." 표시 기능
- 프론트엔드: refreshToken 보안 강화를 위한 httpOnly Cookie 적용
- 프론트엔드: WebSocket 재연결 시 Apollo Client 토큰 갱신
- 프론트엔드: 읽지 않은 메시지 수가 포함된 채팅방 목록 UI
