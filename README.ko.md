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
- AI 채팅: 4가지 선택 가능한 성격을 지원하는 Google Gemini 2.5 Flash
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
  pnpm migration:generate
  pnpm build
  pnpm migration:run
  ```

  # Docker로 Redis 실행
  ```powershell
  docker start redis-chat
  ```

  # 백엔드 실행 (backend 디렉토리에서 실행)
  ```powershell
  cd backend && pnpm start:dev
  ```

  # 프론트엔드 실행 (별도 터미널)
  `frontend/.env.local`에 백엔드 URL을 설정합니다.
  ```env
  VITE_API_URL=http://localhost:3000
  VITE_WS_URL=ws://localhost:3000
  ```
  ```powershell
  cd frontend && pnpm install && pnpm dev      # http://localhost:5173 에서 실행
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
    - ✅ 트랜잭션 요소(`commitTransaction()`, `rollbackTransaction()`, `release()`)는 `backend/src/chat/interceptor/gql-transaction.interceptor.ts`에서 확인하세요. 커밋은 리졸버가 반환한 이후에 실행되므로, 커밋 이후 로직은 `ctx.req.transactionCommitted`를 대기하는지 확인하세요.


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
- `GET /user` - 전체 사용자 조회 **(admin 전용)**
- `GET /user/:id` - 특정 사용자 조회 (본인 또는 admin)
- `POST /user` - 사용자 생성
- `PATCH /user/:id` - 사용자 수정 (본인 또는 admin)
- `PATCH /user/:id/role` - 사용자 역할 변경 **(superadmin 전용)**
- `POST /user/:id/force-logout` - 강제 로그아웃 **(admin 전용)**
- `DELETE /user/:id` - 사용자 삭제 (본인 또는 admin)

**감사 로그**
- `GET /audit-log` - 최근 감사 로그 100건 조회 **(admin 전용)**

**채팅**
- Socket.IO
  ***탭 1***
  - URL: `ws://localhost:3000`
  - 설명: Postman에서 Socket.IO 탭 두 개를 열고 메시지를 전송합니다.
  - 요청 핸들러
    - 기본 요청 핸들러: Socket.IO
    - Headers
      - key : authorization; value: Bearer token
    - Events: sendMessage(Listen: ON), CreateRoom(Listen: ON)
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
    - Events: sendMessage(Listen: ON), CreateRoom(Listen: ON)
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


- GraphQL (쿼리 & 추가 뮤테이션)
  - URL: `http://localhost:3000/graphql`
  - Headers: `authorization: Bearer token`

  **쿼리**
  - `getMessages(roomId: Int!, cursor?: Int)` → `[MessageType]` — 커서 기준 이전 메시지 최대 15개 조회 (커서 기반 페이지네이션)
  - `getMyRooms` → `[RoomInfoType]` — 인증된 사용자가 속한 모든 방 목록 조회
  - `getRoom(recipientId: Int!)` → `Int` — 수신자와 공유하는 방 ID 반환, 없으면 null
  - `getOnlineUser` → `[Int]` — Redis에 현재 온라인으로 표시된 사용자 ID 목록
  - `getAllUsers` → `[Int]` — 호출자를 제외한 전체 사용자 ID 목록
  - `getAiUserId` → `Int` — 시스템 AI 유저 ID 반환
  - `getAiPersonalityInfo(roomId: Int!)` → `AiPersonalityInfoType` — 해당 방의 현재 AI 성격 반환

  **뮤테이션**
  - `setAiPersonality(roomId: Int!, personality: AiPersonality!)` → `Boolean` — 방의 AI 성격 설정 또는 변경

  **예시 — `getMessages` (커서 기반)**
  ```graphql
  query {
    getMessages(roomId: 19, cursor: 50) {
      id
      message
      participant { id }
      createdAt
    }
  }
  ```

  **예시 — `setAiPersonality`**
  ```graphql
  mutation {
    setAiPersonality(roomId: 19, personality: CODING)
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
- 언어: TypeScript - 타입 안전하고 견고한 객체 지향 언어, JavaScript의 슈퍼셋. ✔
- 런타임: Node.js - Chrome V8 엔진으로 구축된 JavaScript 런타임, 애플리케이션이 원활하게 실행되는 생태계 제공. ✔
- 프레임워크: Nest.js - TypeScript 프로젝트를 위한 확장 가능한 프레임워크, 지속적으로 성장하는 강력한 프레임워크. ✔
- 아키텍처: 모놀리식 아키텍처 - 일반적인 프로젝트에 적합하고 컴포넌트 단위 결합 및 분리가 용이한 원칙. ✔
- 소켓: Socket.IO - NestJS 공식 문서에 기재된 것처럼, 이 미들웨어 패키지는 POST 메서드를 통한 HTTP 요청으로 multipart/form-data 형식을 처리하는 방법을 제공하여 애플리케이션이 쉽게 처리할 수 있게 합니다. ✔
- AI: Google Gemini 2.5 Flash - 선택 가능한 성격을 통한 AI 채팅 응답 ✔
- 인증: JWT 인증 - 애플리케이션 사용을 위한 사용자 유효성 검증 ✔
- 가드: 유효한 데이터 타입만 허용 ✔
- 인터셉터: 사용자 데이터를 조작하는 미들웨어 ✔
- 역할 기반 접근: 권한 클래스로 사용자 레벨 구분 ✔
- 채팅: 주요 웹소켓 구현 ✔
- 캐시: Redis - 메시지 속도 제한 및 사용자 데이터의 효율적인 저장. ✔
- 필터: 예외 핸들러 ✔
- 로거: 애플리케이션 실행 중 이벤트, 오류, 디버그 정보 기록 ✔
- 유닛 테스트: 각 유닛별 서비스 메서드 테스트 ✔
- Swagger: 각 엔드포인트 테스트를 위한 메서드 기반 문서화 ✔


## 기능
- 실시간 양방향 메시지 전송
- 속도 제한 - 사용자당 15초당 10개 메시지
- 서버 재시작 시에도 유지되는 사용자 세션
- 사용자 간 개인 채팅방
- 트랜잭션 안전한 메시지 저장 및 전달
- Redis 기반 세션으로 수평 확장 지원
- Google Gemini 2.5 Flash 기반 AI 채팅 (4가지 성격: 친절한 어시스턴트, 코드 도우미, 영어 선생님, 창의적인 작가)
- 커서 기반 메시지 히스토리 및 무한 스크롤


## 아키텍처
### 프로젝트 구조
```
Chat Project/                   ← 모노레포 루트
├── backend/                    ← NestJS 애플리케이션
│   └── src/
│       ├── ai/                 ← Gemini AI (AiService, AiRoomService)
│       │   ├── constants/      ← system-prompts.ts, AI_USER_EMAIL
│       │   └── enums/          ← ai-personality.enum.ts
│       ├── auth/               ← JWT 인증, 가드, 전략
│       │   ├── decorator/
│       │   ├── dto/
│       │   ├── guard/          ← JwtAuthGuard, RbacGuard, GraphqlAuthGuard
│       │   ├── interface/      ← Payload (JWT payload shape)
│       │   ├── role/
│       │   └── strategy/       ← passport-local, passport-jwt
│       ├── base/
│       │   ├── entity/         ← EntityBase (생성/수정 타임스탬프)
│       │   └── logger/         ← winston 로거
│       ├── chat/               ← ChatGateway, ChatService, ChatResolver
│       │   ├── decorator/      ← gql-query-runner.decorator
│       │   ├── entities/       ← ChatEntity, RoomEntity
│       │   │   └── dto/        ← CreateChatDto
│       │   ├── guard/          ← RateLimitGuard
│       │   └── interceptor/    ← GqlTransactionInterceptor
│       ├── graphql/            ← PubSubService, GraphQL 입력/반환 타입
│       ├── migrations/         ← TypeORM 마이그레이션 파일
│       ├── mocks/              ← 테스트용 bcrypt 목
│       ├── redis/              ← RedisModule, SessionCacheService
│       │   └── interface/      ← CachableMessage (graphql/pubsub.service.ts와 공유)
│       └── user/               ← UserController, UserService, UserEntity
│           ├── dto/
│           └── entities/
└── frontend/                   ← React + Vite 애플리케이션
    └── src/
        ├── api/                ← apollo.ts, axios.ts, graphql-operations.ts
        ├── components/         ← ProtectedRoute
        ├── pages/              ← ChatPage, SigninPage, RegisterPage
        ├── socket/             ← socket.ts (Socket.IO 싱글톤)
        ├── store/              ← auth.store.ts (Zustand)
        └── types/
```

### 하이브리드 저장소 패턴
- Redis(세션/캐시): 일관된 데이터 흐름과 서버 공유를 위해 `userId` => `socketId` 매핑 저장
- 인메모리(소켓): 쉬운 구현과 실시간 통신이 가능한 WebSocket 작업에 필요한 `socketId` => `Socket` 객체 저장
- 두 방식을 함께 사용하는 이유: Redis는 직렬화된 객체를 'JSON' 형식으로 저장하는 반면, 소켓은 클라이언트가 TCP 레벨 연결을 통해 연결된 동안에만 저장합니다. 따라서 클라이언트는 세션/캐시 데이터로 재연결할 수 있습니다.

### Redis Pub/Sub
- `RedisPubSub` 싱글톤 (`pubsub.service.ts`): GraphQL 뮤테이션과 활성 구독 간의 브리지 역할. 커밋 후 리졸버가 `receiveMessage :${roomId}` 채널에 발행하면, 연결된 모든 `receiveMessage` 구독자가 실시간으로 메시지를 수신합니다.
- `PubSubService.publish()`는 발행 시점에 부수효과로 `SessionCacheService.cacheMessage()`를 호출해 메시지를 캐싱합니다 — 사람 메시지와 AI 메시지 모두 동일하게, 메시지 캐싱이 일어나는 **유일한** 지점입니다. 리졸버나 `AiService`가 직접 `cacheMessage()`를 호출하지 않습니다.

### 엔티티 (TypeORM)
```
UserEntity
  id          PK
  email       unique
  password    API 응답에서 제외
  isAI        boolean (시드된 AI 시스템 계정에만 true)
  role        enum: user (0) | admin (1) | superadmin (2)
  chats    =< ChatEntity   (OneToMany)
  rooms    >< RoomEntity   (ManyToMany, RoomEntity 측 조인 테이블)

ChatEntity
  id          PK
  message     string
  participant >= UserEntity  (ManyToOne — 발신자)
  room        >= RoomEntity  (ManyToOne)

RoomEntity
  id            PK
  aiPersonality nullable string (해당 방의 현재 AI 성격)
  participants >< UserEntity   (ManyToMany 소유자, @JoinTable)
  chats        =< ChatEntity   (OneToMany)

EntityBase (세 엔티티 모두 상속)
  created     CreateDateColumn — API 응답에서 제외
  updated     UpdateDateColumn — API 응답에서 제외
```


## 흐름
모든 채팅 메시지는 **GraphQL Mutation 경로**로만 전송·전달됩니다. Socket.IO(`ChatGateway`)는
WebSocket 연결 생명주기만 담당하며, 채팅 메시지를 다루는 `@SubscribeMessage` 핸들러가 없고
어떤 메시지도 emit하지 않습니다.

### Socket.IO 연결 생명주기
1. 클라이언트가 `chat.gateway.ts`의 handleConnection으로 WebSocket 연결
  1.1. `AuthService.parseBearerToken()`으로 JWT 토큰 인증
  1.2. `ChatService.registerClient()`가 `userId` => `socketId`/Socket 매핑
  1.3. `ChatService.joinRooms()`로 클라이언트를 기존 방에 참여시킴
  1.4. 세션 충돌 시, 해당 유저의 이전 소켓은 `forceLogout`을 받고 연결 해제됨

2. 방 생성 알림
  2.1. `ChatService`가 새 `RoomEntity`를 생성하면(두 사용자 간 첫 메시지), 수신자 소켓에
       `CreateRoom`을 emit하여 클라이언트가 새 방에 참여할 수 있게 함

3. 클라이언트 연결 해제
  3.1. `chat.gateway.ts`에서 `handleDisconnect` 실행
  3.2. `ChatService.removeClient()`가 인메모리 Map에서 `socketId` 항목 제거

### GraphQL Mutation 경로 (`sendMessage`)
1. 클라이언트가 `sendMessage` 뮤테이션 호출
  1.1. `GraphQLAuthGuard` + `RateLimitGuard` 실행
  1.2. `GqlTransactionInterceptor`가 리졸버 실행 전에 `QueryRunner`를 열고 트랜잭션을 시작한 뒤,
       `@GqlQueryRunnerDecorator()`로 주입
  1.3. `ChatService.sendMessage()`가 발신자/수신자 검증, 방 조회 또는 생성, 해당 트랜잭션
       내에서 `ChatEntity` 저장
  1.4. 리졸버가 `PubSubService.publish()`로 `receiveMessage :${roomId}` 채널에 발행 후 반환

2. 반환 이후 커밋
  2.1. `GqlTransactionInterceptor`가 리졸버 반환 **이후**에 트랜잭션을 커밋
  2.2. 커밋된 데이터에 의존하는 로직은 반환 시점에 커밋이 끝났다고 가정하지 않고
       `ctx.req.transactionCommitted`를 대기함

3. AI 응답 (수신자가 AI 유저인 경우)
  3.1. `setImmediate`로 AI 응답 트리거를 예약하며, 가장 먼저 `ctx.req.transactionCommitted`를 대기
  3.2. `AiService.handleReply()`가 Redis 락 획득, 대화 히스토리 구성, Gemini API 호출
  3.3. AI 응답을 DB에 저장한 뒤, 사람 메시지와 동일한 `receiveMessage :${roomId}` 채널로 Pub/Sub
       발행 — 캐싱은 `PubSubService.publish()`가 부수효과로 처리함(위 Redis Pub/Sub 참고),
       `AiService`가 직접 캐싱하지 않음

4. 구독자 메시지 수신
  4.1. Redis Pub/Sub이 활성 `receiveMessage(roomId)` 구독자에게 전달
  4.2. GraphQL 구독 리졸버가 페이로드를 클라이언트에 push


## 빌드
### 전체 설치
의존성 (35개)
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

- 프로젝트 루트에 `.env.local` 필요 (`backend/.env.example`에서 복사 후 조정 - `NODE_ENV=docker`)

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
`docker compose exec redis redis-cli ping`


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
- 세 가지 역할: `user` (0, 기본값), `admin` (1), `superadmin` (2).
- 모든 가입 사용자는 `user` 역할을 부여받아 메시지 전송이 가능합니다.
- `admin` 역할은 상위 권한을 가지며, 모든 사용자 계정 조회·수정·삭제, 강제 로그아웃, 감사 로그 조회가 가능합니다.
- `superadmin` 역할은 역할 변경 권한을 추가로 보유합니다. 다른 사용자의 역할 승격·강등은 superadmin만 가능합니다.
- 최초 superadmin은 DB에 직접 INSERT하여 생성합니다. 이후 admin은 admin 패널에서 승격 가능합니다.
- `MAX_ADMIN_COUNT` 환경변수(기본값: 5)로 `admin` 역할 계정 수를 제한합니다. superadmin은 이 상한에 포함되지 않습니다.


### Admin 계정 생성
최초 superadmin은 데이터베이스에 직접 생성해야 합니다. API 엔드포인트에서 `user` 이상의 역할을 부여하지 않아 공격 면을 최소화합니다.

**1단계 — bcrypt 해시 생성** (`.env`의 `HASH_ROUNDS` 값과 동일하게 설정):
```bash
node -e "const b=require('bcrypt'); b.hash('yourPassword', 12).then(h=>console.log(h))"
```

**2단계 — DB에 직접 INSERT** (Railway 쿼리 실행기 또는 DB 클라이언트):
```sql
INSERT INTO user_entity (email, password, role, "isAI")
VALUES ('superadmin@example.com', '<1단계에서 생성한 해시>', 2, false);
```

역할 숫자: `user = 0`, `admin = 1`, `superadmin = 2`

**Railway 사용 시**
1. Railway Dashboard → PostgreSQL 서비스 → **Query** 탭 열기
2. 위의 INSERT 구문 실행


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
- `AiService` - Gemini API 호출, 대화 히스토리 구성(최근 10개 메시지), Redis 분산 락으로 방당 중복 응답 방지
- `AiRoomService` - 방별 성격 선택 및 조회 관리

**성격 목록**
- `FRIENDLY`: 일반 Q&A, 따뜻하고 격려하는 말투
- `CODING`: 프로그래밍 전문, 코드 예시 중심
- `ENGLISH`: 영작 교정 및 자연스러운 표현 제안
- `CREATIVE`: 스토리텔링, 브레인스토밍, 글쓰기 도움

**사용 방법**
1. Conversations 배너에서 **AI Chat** 클릭
2. 첫 메시지 전송 시 성격 선택
3. 변경 시: **성격 변경** 버튼 클릭 (횟수 제한 없음)

**토큰 비용 최적화**
- 모델: `gemini-2.5-flash` (Pro 대비 비용 효율적인 Flash 티어)
- `maxOutputTokens: 300`으로 응답 길이 상한 고정
- 대화 컨텍스트를 최근 10개 메시지로 제한(`AI_HISTORY_LIMIT`) - 전체 히스토리 전송 방지
- 시스템 프롬프트로 응답 길이 강제: 가벼운 대화·인사 1-3줄, 설명이 필요한 질문 4-5줄, 최대 5줄 초과 금지

**Rate Limiting & 비용 제어**
- 기존 `RateLimitGuard`(사용자당 15초당 10개)가 `sendMessage` 뮤테이션에 동일 적용되어 AI 호출 빈도를 간접적으로 제한
- Redis 분산 락(`ai:lock:${roomId}`, TTL 30s)으로 동일 방에서 AI 응답이 동시에 중복 생성되는 것을 방지
- AI 응답은 수신자가 AI 유저(`recipientId === aiUserId`)일 때만 트리거

**응답 전달 방식**
- `generateContent()` 완전 응답을 목적으로 사용
- AI 응답 전문이 WebSocket 브로드캐스트와 GraphQL Pub/Sub을 통해 단일 메시지로 전달

**시스템 프롬프트**
- 성격별 `systemInstruction` 문자열을 Gemini API의 `config.systemInstruction`으로 전달
- 모든 성격에 공통 적용되는 두 가지 규칙:
  - 언어 감지: 사용자 메시지와 동일한 언어로 응답
  - 길이 제어: 가벼운 대화·인사 1-3줄, 설명이 필요한 질문 4-5줄

**에러 처리**
- `handleReply`는 Gemini 및 DB 호출을 `try/catch/finally`로 감싸고, 에러 로깅 후 `finally`에서 Redis 락을 항상 해제
- AI 응답은 리졸버의 `setImmediate(...).catch(...)` 내부에서 실행 - 실패해도 발신자의 메시지 응답에 영향 없음
- 락 TTL(30s)로 서버 크래시 중에도 락 자동 만료 보장


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
- Auth Service: 89.02%
- Chat Service: 94.44%
- Redis Service: 100%
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
          mockManager as EntityManager,
        );

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(jest.mocked(chatService.findRoom)).toHaveBeenCalledWith(
          mockSender.id,
          mockRecipient.id,
          mockManager as EntityManager,
        );
        expect(result).toEqual(mockRooms);
      });
    });
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


#### Admin 패널 - Vercel
frontend와 동일한 패턴으로 **별도 Vercel 프로젝트**로 배포됩니다. GitHub Actions와는 무관하며, Vercel이 push 시 독립적으로 빌드·배포합니다.

**CI/CD 흐름**
`git push origin main` => Vercel 자동 배포

**설정**
- 루트 디렉토리: `admin/`
- 모노레포 패키지 해석을 위한 `pnpm-workspace.yaml`
- 환경변수: `VITE_API_URL` (frontend와 동일한 백엔드)


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


## AI 보조 개발 사례

### 라이브 테스트 중 인프라 보안 위협 탐지

코드 리뷰와 단위 테스트만으로는 잡기 어려운 인프라 수준 취약점을 AI 보조 라이브 테스트 세션에서 발견하고 대응한 사례입니다.

**발단**
Swagger + curl을 이용한 API 라이브 테스트 도중 AI(Claude Code)가 Docker Compose 설정을 검토하던 중 다음을 발견했습니다:
- 모든 서비스 포트가 `0.0.0.0:PORT:PORT`로 바인딩되어 모든 네트워크 인터페이스에 노출
- 개발 머신의 Ethernet 어댑터가 공인 IP를 보유하면서 Windows 방화벽 프로파일이 "Private(신뢰)"으로 설정됨
- 결과: PostgreSQL(5432), Redis(6379), 백엔드(3000)가 인터넷에 노출

**실제 피해 확인**
자동화된 랜섬웨어 봇이 PostgreSQL 기본 자격증명으로 접근해 데이터베이스를 삭제한 뒤, `readme_to_recover` 데이터베이스의 `readme` 테이블에 비트코인 요구문을 남겼습니다.

**AI가 수행한 것**
1. Docker 포트 바인딩 `0.0.0.0` → `127.0.0.1` 수정 (`docker-compose.yml`)
2. `backend/src/main.ts` 호스트를 개발 환경에서 `127.0.0.1`로 제한
3. Redis `requirepass` 추가
4. DB 패스워드, Redis 패스워드, JWT Access/Refresh 시크릿 전체 로테이션
5. Windows 방화벽 프로파일 Public 전환 안내 (사용자 직접 수행)

**AI가 수행하지 않은 것 — 프롬프트 인젝션 방지**
`readme_to_recover.readme` 테이블 내용을 SQL 쿼리로 직접 읽지 않았습니다. 공격자가 DB에 AI 지시문을 심었을 경우, AI 도구가 그 내용을 컨텍스트에 로드하는 순간 의도치 않은 명령이 실행될 수 있기 때문입니다. AI는 테이블의 위치와 존재만 설명하고 내용 확인을 사용자에게 위임했으며, 사용자가 직접 확인한 결과 표준 비트코인 요구문으로 판단됐습니다.

**대응 순서 — 봉쇄 우선**
랜섬웨어 DB를 먼저 삭제하자는 판단도 있었지만, 접근 경로가 열린 상태에서 삭제해도 봇이 즉시 재생성 가능하므로 다음 순서를 지켰습니다:
1. 네트워크 봉쇄 (포트 바인딩 + 방화벽)
2. 자격증명 로테이션
3. 아티팩트 제거

**교훈**
- AI 보조 라이브 테스트는 코드 리뷰와 CI만으로는 드러나지 않는 배포 환경 취약점을 탐지합니다
- AI 도구가 외부에서 생성된 컨텐츠(DB 행, 업로드 파일 등)를 직접 읽는 것은 프롬프트 인젝션 경로가 됩니다. 내용 확인은 사람이 직접 해야 합니다
- 보안 사고 대응 순서는 **봉쇄 → 로테이션 → 정리**입니다. 순서가 바뀌면 정리가 무의미해집니다

### 라이브 브라우저 테스트 중 발견한 AI 응답 캐시 손상

새로 추가한 AI 응답 재시도/폴백 기능을 라이브 브라우저 세션에서 수동 검증하던 중, 백엔드 재시작으로 소켓이 재연결되며 방의 메시지 기록을 캐시에서 다시 불러올 때 콘솔 에러(`CombinedGraphQLErrors: Invalid time value`)가 발생했습니다.

**근본 원인**
`AiService`가 자신의 응답을 직접 캐싱하고, `PubSubService`의 발행 시점 훅이 한 번 더 캐싱했는데 — 이때 넘어간 값은 `plainToClass`로 직렬화된 사본이라 `@Exclude()`가 붙은 `created` 필드가 이미 제거된 상태였습니다. 이 손상된 캐시 항목은 이후 `getCachedMessages`를 거치며 `new Date(undefined)`(유효한 `Date` 인스턴스이지만 내부적으로 `NaN`)가 되었고, 캐시에서 읽은 `getMessages` 응답에 그 항목이 포함되는 순간 GraphQL의 기본 `DateTime` 스칼라(`value.toISOString()`)가 크래시했습니다.

**AI가 수행한 것**
1. `psql`로 DB의 `created` 컬럼을 직접 조회해 데이터 자체의 손상 여부를 배제
2. `@nestjs/graphql`의 실제 `DateTime` 스칼라 구현을 읽어 정확한 크래시 조건 확인
3. 캐시 쓰기 지점 두 곳(`ai.service.ts`, `pubsub.service.ts`)을 추적해 중복되고 일관되지 않은 캐싱 경로를 발견
4. 과거 캐싱 리팩터링 커밋에 `git show --stat`을 실행해, 이 중복이 의도된 설계가 아니라 그 리팩터링이 `ai.service.ts`를 건드리지 않아 생긴 누락임을 확인
5. `AiService`가 원본 엔티티를 발행하도록 수정(사람 메시지 경로와 동일하게 맞춤)하고, 중복된 직접 캐싱 호출 제거
6. 회귀 테스트 추가: `created` 필드가 없는 경우의 `getCachedMessages` 케이스, 그리고 신규 `pubsub.service.spec.ts`

**교훈**
- 라이브 브라우저 테스트가 단위 테스트로는 절대 못 잡는 서비스 간 버그를 드러냈습니다 — 기존 목(mock)들이 정확히 손상이 발생하던 계층(`PubSubService`의 발행-시-캐싱 부수효과)을 격리하고 있었기 때문입니다
- 의심되는 커밋에 `git show --stat`을 실행하는 것으로 "불완전한 리팩터링의 누락"인지 "의도된 설계"인지 추측 없이 객관적으로 확인할 수 있습니다
