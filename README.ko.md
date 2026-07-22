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
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> English version: [README.md](README.md)

# 실시간 채팅 애플리케이션
- 개인 1:1 실시간 채팅 서비스로, 600개 이상의 커밋(2026-01 ~ 현재, 정확한 수는 [CHANGELOG.md](CHANGELOG.md) 참고)에 걸쳐 혼자 반복 개발하며 Socket.IO, Redis, 인증, 그리고 이후에는 실전 보안 인시던트와 행동 기반 모더레이션 시스템까지 다뤘습니다.
- 최소한의 인증 사용자 채팅 프로토타입으로 시작해, AI 챗봇 동반자, 별도 admin 패널, 행동 기반 모더레이션, 3개 서비스에 걸친 CI/CD를 갖춘 시스템으로 성장했습니다.


## 개요
실시간 1:1 개인 채팅 서비스로, 6개월 이상(600개 이상의 커밋, [CHANGELOG.md](CHANGELOG.md) 참고)에 걸쳐 초기 프로토타입에서 아키텍처 전환, 실전 보안 인시던트 대응, 행동 기반 모더레이션 시스템까지 반복 발전했습니다.
- 인증: Passport 전략 기반 JWT 인증 — refreshToken은 httpOnly 쿠키, accessToken은 메모리에만 보관
- 채팅 관리: Socket.IO(연결 라이프사이클 전용) + GraphQL(메시지용 Mutation/Subscription), 트랜잭션 안전성을 갖춘 Redis 기반 세션/캐시
- 모더레이션: 중복/도배 및 속도 기반 자동 스트라이크 탐지가 경고 → 뮤트 → 기간제/영구 밴으로 에스컬레이션, admin 복구 도구 제공
- AI 채팅: Google Gemini 2.5 Flash, 선택 가능한 4가지 성격, 비용 상한 설계(토큰 제한, 재시도 상한)
- Admin 패널: 유저/방 관리, 모더레이션 액션, 감사로그 export를 위한 별도 React 앱
- API 문서: Swagger 연동 + Altair & GraphQL
- 테스트: 핵심 서비스 계층 전반의 유닛 테스트([테스트 커버리지](#테스트-커버리지)에 서비스별 정확한 수치 참고) + 메인 앱과 admin 패널 양쪽의 Playwright e2e

개발 중 실제로 겪은 두 가지 인시던트 — 라이브 인프라 보안 노출과 AI 응답 캐시 손상 버그 — 는 근본원인 분석까지 포함해 [AI 보조 개발 사례](#ai-보조-개발-사례)에 정리되어 있습니다.


## 프로젝트 동기
- 600개 이상의 커밋(2026-01-02 ~ 현재, 정확한 수는 [CHANGELOG.md](CHANGELOG.md) 참고)에 걸쳐 혼자 반복 개발: Socket.IO 연결 처리, Redis 세션/캐시/pub-sub, 그리고 실시간 전송에서 raw WebSocket 메시징과 GraphQL Subscription 간의 트레이드오프
- 메시지 전송 경로를 Socket.IO 직접 전송에서 트랜잭션 보장이 있는 GraphQL Mutation/Subscription 분리 구조로 **이미 동작 중인 앱에서** 마이그레이션 — 이런 변경이 이론이 아니라 실제 운영 중인 시스템에서 어떤 비용을 요구하는지 체감하기 위함
- Basic/Bearer/JWT, RBAC 가드까지 인증/인가를 end-to-end로 실습 — 직접 발견한 XSS/localStorage 토큰 저장 취약점을 찾아 수정한 경험 포함
- 실전 보안 인시던트(노출된 로컬 개발 포트로 랜섬웨어 봇이 개발 DB를 삭제한 사건) 대응 — 봉쇄, 자격증명 교체, 정리까지 전 과정을 사례로 남기고 넘어가지 않음
- KISS/YAGNI를 기본 원칙으로 유지하되 기능 데모 수준에서 멈추지 않음 — 행동 기반 모더레이션 파이프라인, 별도 admin 패널, 실제 서비스에 필요한 수준의 CI/CD(GitHub Actions + Railway/Vercel)까지 구축


## 라이브 데모
- 프론트엔드: https://chat-project-frontend-ten.vercel.app
- REST API: https://chat-project-production-3b22.up.railway.app
- WebSocket: wss://chat-project-production-3b22.up.railway.app


## 빠른 시작
- 사전 요구사항
  - Node.js >= v24.xx
  - Nest.js >= v11.xx
  - PostgreSQL 18
  - pnpm >= 10 (정확히 고정된 버전은 [CONTRIBUTING.md](CONTRIBUTING.md#prerequisites) 참고) 또는 npm >= v10.xx
  - Docker >= v28.xx

**의존성 설치**
```powershell
pnpm install
```

**환경 설정** — `backend/.env`로 복사 후 자격증명을 입력합니다.
```powershell
cp backend/.env.example backend/.env
```

**마이그레이션으로 데이터베이스 스키마 생성**
```powershell
cd backend
pnpm migration:run
```

**Docker로 Redis 실행**
```powershell
docker start redis-chat
```

**백엔드 실행** (backend 디렉터리에서 실행)
```powershell
cd backend && pnpm start:dev
```

**프론트엔드 실행** (별도 터미널) — 템플릿을 복사하고, 백엔드가 다른 곳에서 실행 중이면 값을 조정하세요:
```powershell
cp frontend/.env.example frontend/.env.local
cd frontend && pnpm install && pnpm dev
```
→ http://localhost:5173

**Admin 패널 실행** (별도 터미널) — 템플릿을 복사하세요(보통 조정 불필요):
```powershell
cp admin/.env.example admin/.env.local
cd admin && pnpm install && pnpm dev
```
→ http://localhost:5174 — 어떤 기능이 있는지는 [Admin 패널](#admin-패널) 참고. admin/superadmin 계정이 필요합니다([Admin 계정 생성](#admin-계정-생성) 참고)

**채팅 통신 테스트** — 채팅 메시지는 GraphQL(전송은 Mutation, 수신은
Subscription)로만 오갑니다. Socket.IO는 연결 라이프사이클과 방 생성
알림만 처리하며 채팅 메시지 트래픽은 전혀 다루지 않습니다. Altair/Postman을
통한 GraphQL 실습은 아래 **API 문서 → 주요 엔드포인트 → 채팅** 섹션을
참고하세요.

**전체 테스트 실행**
```powershell
pnpm test
```

**테스트 커버리지 실행** (backend 디렉터리에서 실행)
```powershell
cd backend && pnpm test:cov
```

**Swagger UI 접속** — http://localhost:3000/document


### 문제 해결
프로그램 실행 시 발생하는 문제 목록입니다.
- Redis 연결 문제
  - 로그: "GraphQLModule dependencies initialized"
  - 로그: "Redis Error: AggregateError [ECONNREFUSED]"
  - 로그: "Error: connect ECONNREFUSED ::IPv6 주소:포트"
  
  - 해결책 
    - ✅ 터미널에서 `docker start redis-chat` 실행

- DB에 메시지 저장 실패

  - 해결책 
    - ✅ 트랜잭션 요소(`commitTransaction()`, `rollbackTransaction()`, `release()`)는 `backend/src/chat/interceptor/gql-transaction.interceptor.ts`에서 확인하세요. 커밋은 리졸버가 반환한 이후에 실행되므로, 커밋 이후 로직은 `ctx.req.transactionCommitted`를 대기하는지 확인하세요.


## API 문서
### Swagger UI
***모든 기능을 테스트하려면 먼저 회원가입을 해야 합니다.***
Altair로는 Mutation을, Postman으로는 Subscription을 테스트할 수 없습니다. 그래서 두 도구가 역할을 나눠 맡아야 채팅 통신을 빠짐없이 테스트할 수 있습니다.

### 주요 엔드포인트
**Swagger**
아래 URL에서 'Auth' 및 'User' 엔드포인트를 테스트하세요.
- URL: `http://localhost:3000/document`

**Health**
- `GET /health` - 인증 불필요, liveness 체크 — Railway의 `healthcheckPath`가 사용; DB/Redis 확인 없이 `{ status: 'ok' }` 반환(의존성 장애가 컨테이너 재시작을 유발하지 않도록)

**인증**
- `POST /auth/register` - Basic Auth로 회원가입 — 선택적 body `{ nickname? }`, IP당 60초/10회 rate limit(초과 시 429)
- `POST /auth/signin` - JWT 토큰 발급 — register와 동일하게 IP당 60초/10회 rate limit
- `POST /auth/signOut` - 현재 액세스 토큰을 블랙리스트 처리하고 refreshToken 쿠키 삭제(토큰이 이미 만료/무효해도 쿠키는 삭제됨)
- `POST /auth/token/refreshaccess` - 액세스 토큰 갱신

**사용자** — 계정 생성은 위 `POST /auth/register`를 통해서만 가능, 여기 없음
- `GET /user` - 사용자 목록 조회 **(admin 전용)** — 쿼리 파라미터: `page`, `take`, `sort`(`ASC`/`DESC`), `sortBy`(`id`/`role`/`created`), `search`(이메일/닉네임), `status`(`active`/`banned`), `humanOnly`(시딩된 AI 계정과 moderation 시스템 계정 제외)
- `GET /user/:id` - 특정 사용자 조회 (본인 또는 admin)
- `PATCH /user/:id` - 사용자 수정 (본인 또는 admin) — 선택적 body `{ email?, password?, nickname?, profileImage? }`(nickname은 20자 이하이며 고유해야 함; profileImage는 base64 data URI, jpeg/png/webp, 2MB 이하); 닉네임이 이미 사용 중이면 400
- `PATCH /user/:id/role` - 사용자 역할 변경 **(superadmin 전용)**
- `POST /user/:id/force-logout` - 강제 로그아웃 **(admin 전용)**
- `POST /user/:id/ban` - 자동 스트라이크 시스템과 무관하게 수동으로 밴 **(admin 전용)** — 선택적 body `{ reason?, durationSec? }`(`durationSec` 생략 시 영구 밴), 활성 세션도 즉시 종료
- `POST /user/:id/unban` - 밴/뮤트/스트라이크 해제 **(admin 전용)**
- `DELETE /user/:id` - 사용자 삭제 (본인 또는 admin) — 시딩된 AI 계정과 moderation 시스템 계정은 삭제 불가

**감사 로그**
- `GET /audit-log` - 페이지네이션된 감사 로그 조회 **(admin 전용)** — 쿼리 파라미터: `action`(`ROLE_CHANGE`/`FORCE_LOGOUT`/`USER_DELETE`/`USER_UNBAN`/`USER_MUTED`/`USER_BANNED`), `userId`(actor 또는 target으로 매칭), `from`/`to`(ISO 8601 날짜 범위), `page`, `take`, `sort`
- `GET /audit-log/export` - 동일한 필터 결과를 CSV로 export, 최대 10,000행 캡(저볼륨 권한 데이터라 커서 스트리밍보다 단순한 상한을 선택) **(admin 전용)**

**채팅**
- Socket.IO (연결 라이프사이클과 방 생성 이벤트만 처리 — 채팅 메시지 트래픽은 전혀 다루지 않음)
  ***탭 1 & 2***
  - URL: `ws://localhost:3000`
  - 설명: Postman에서 Socket.IO 탭 두 개를 엽니다. Socket.IO는 연결 인증을 처리하고 새 방이 생성되면 클라이언트에 알립니다. 채팅 메시지의 송수신은 아래 GraphQL Mutation/Subscription 경로로만 이루어집니다.
  - 요청 핸들러
    - 기본 요청 핸들러: Socket.IO
    - Headers
      - key : authorization; value: Bearer token
    - Events: `CreateRoom`(Listen: ON) — 두 사용자 간 새 방이 생성될 때 서버가 발생시킴


- Altair (구독)
  - URL: POST `http://localhost:3000/graphql`
  - 설명: 이 단계는 다른 GraphQL 클라이언트로 대체해도 됩니다. Altair에서 탭을 열고 아래처럼 요청 핸들러를 설정한 뒤 GraphQL에 연결하세요. 연결에 성공하면, GraphQL로 메시지를 전송할 때 수신자 입장에서 채팅 통신을 테스트할 수 있습니다.

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
  - 설명: 이 단계는 다른 도구로 대체할 수 없습니다. Postman에서 GraphQL 탭을 열고 아래처럼 사전 요구사항을 설정한 뒤 Altair와 연결하세요. 설정이 끝나면 발신자 입장에서 채팅 통신을 테스트할 준비가 완료됩니다.

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
        "message": "Sent from Postman"
      },
      "recipientId": 2
    }
    ```


- GraphQL (쿼리 & 추가 뮤테이션)
  - URL: `http://localhost:3000/graphql`
  - Headers: `authorization: Bearer token`

  **쿼리**
  - `ping` → `String` — 인증 불필요한 헬스체크 쿼리, `"ping has returned."` 반환
  - `getMessages(roomId: Int!, cursor?: Int)` → `[MessageType]` — 커서 기준 이전 메시지 최대 15개 조회 (커서 기반 페이지네이션)
  - `getMyRooms` → `[RoomInfoType]` — 인증된 사용자가 속한 모든 방 목록 조회
  - `getRoom(recipientId: Int!)` → `Int` — 수신자와 공유하는 방 ID 반환, 없으면 null
  - `getOnlineUser` → `[Int]` — Redis에 현재 온라인으로 표시된 사용자 ID 목록
  - `getAllUsers` → `[Int]` — 호출자를 제외한 전체 사용자 ID 목록
  - `getUserNicknames` → `[UserType]` — AI를 제외한 전체 사용자의 `{id, nickname, profileImage}` 목록 — 표시 이름/아바타 해석에 사용(채팅) 또는 표시 이름만 사용(Admin Panel — profileImage는 조회 안 함)
  - `getAiUserId` → `Int` — 시스템 AI 유저 ID 반환
  - `getSystemUserId` → `Int` — 모더레이션 시스템 계정 ID 반환 (자동 감사 로그 항목, 예: `USER_MUTED`/`USER_BANNED`의 행위자로 사용됨)
  - `getAiPersonalityInfo(roomId: Int!)` → `AiPersonalityInfoType` — 해당 방의 현재 AI 성격 반환
  - `getAllRooms(page?: Int, take?: Int, sort?: String, sortBy?: String, search?: String)` → `PaginatedAdminRooms` — **(admin 전용)** 페이지네이션/정렬/검색이 가능한 방 목록 — Admin Panel Rooms 페이지가 사용

  **뮤테이션**
  - `setAiPersonality(roomId: Int!, personality: AiPersonality!)` → `Boolean` — 방의 AI 성격 설정 또는 변경
  - `deleteRoom(roomId: Int!)` → `Boolean` — **(admin 전용)** 방 삭제

  `getAllRooms`/`deleteRoom`은 `@RBAC(UserRole.admin)` + `@UseGuards(GraphQLAuthGuard, GraphQLRBACGuard)`로 보호됨 — REST 쪽 admin 가드 체인을 GraphQL 쪽에 그대로 대응시킨 것([역할](#역할) 참고).

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

- 스택: React 19.2.5, TypeScript ~6.0.2, Vite 8.0.10, Tailwind CSS 4.2.4, Zustand 5.0.12, Apollo Client 4.1.9, Socket.IO Client 4.8.3 ✔
- 인증: 액세스 토큰은 메모리(Zustand), 리프레시 토큰은 백엔드가 설정하는 httpOnly 쿠키 — localStorage에 저장하지 않음 ✔
- 실시간: Socket.IO로 연결/방 관리, GraphQL Mutation/Subscription으로 메시지 처리 ✔
- 보안: DOMPurify를 통한 XSS 방지, CORS 준수 요청, 보호된 페이지를 위한 Route Guard ✔
- 배포: Vercel (푸시 시 자동 배포) ✔

### 백엔드
- **언어**: TypeScript 5.7.3 — backend/frontend/admin 전체에 걸친 정적 타이핑으로, 초기 raw 디버깅 단계(1~3월 커밋 히스토리 참고)에서 반복적으로 겪었던 `undefined` 프로퍼티류 버그를 잡음
- **런타임**: Node.js 24.x(`.nvmrc`/`engines`로 고정) — 논블로킹 I/O가 연결 밀집형 채팅 워크로드에 적합
- **프레임워크**: NestJS 11.1.19 — DI 기반 모듈 경계 덕분에 리졸버 하나였던 규모에서 십수 개 모듈(auth/chat/moderation/ai/admin)로 커지는 동안 결합도를 낮게 유지
- **아키텍처**: 모놀리식, 단일 배포 단위 — 모듈 경계([프로젝트 구조](#프로젝트-구조) 참고)로 이 규모에 굳이 필요 없는 서비스 메시 복잡도 없이 관심사를 분리
- **실시간 처리 분리**: Socket.IO 4.8.3은 연결 라이프사이클 전용(연결 시 인증, 방 생성 알림), 채팅 메시지는 GraphQL 16.12.0 Mutation/Subscription([흐름](#흐름) 참고) — 원래 설계는 아니었고, 메시지 저장에 트랜잭션 보장(`GqlTransactionInterceptor`)을 주기 위해 프로젝트 중반에 raw Socket.IO에서 마이그레이션함
- **데이터베이스**: PostgreSQL + TypeORM 0.3.29 — 상호 의존적인 유저/방/채팅/감사로그 데이터의 관계형 정합성; 마이그레이션 전용(`synchronize: false`)으로 스키마 변경을 리뷰 가능하게 유지
- **캐시/Pub-Sub**: ioredis 5.9.3 기반 Redis — 세션/온라인 상태, 방별 최근 메시지 캐시, 수평 확장을 위한 `@socket.io/redis-adapter`(없으면 방 브로드캐스트가 서버 인스턴스 간에 전달되지 않음)
- **AI**: `@google/genai`를 통한 Google Gemini 2.5 Flash, 선택 가능한 성격 4종 — 설계 단계부터 비용 상한 적용(출력 토큰 제한, 대화 이력 절단, 재시도 상한), 나중에 요금 폭탄 맞고 붙인 게 아님
- **인증**: JWT(액세스 토큰은 메모리, 리프레시 토큰은 httpOnly 쿠키) + Passport 전략; RBAC 가드는 REST와 GraphQL 계층 모두에서 서브클래싱이 아니라 조합(composition)으로 구성
- **테스트**: 서비스 계층에 대한 Jest 유닛 테스트([테스트 커버리지](#테스트-커버리지) 참고), `frontend/`와 `admin/` 양쪽에 Playwright e2e
- **API 문서**: REST용 Swagger + Altair를 통한 GraphQL introspection — Altair와 Postman 어느 한쪽만으로는 두 메시지 전송 경로를 모두 테스트할 수 없어 각각 필요


## 기능
- 실시간 양방향 메시지 전송
- 속도 제한 - 사용자당 15초당 10개 메시지
- 행동 기반 모더레이션 - 중복/도배 및 속도 기반 스트라이크가 경고 → 뮤트 → 기간제 밴 → 영구 밴으로 에스컬레이션, admin unban 지원
- 보안 강화 - 백엔드에는 Helmet 보안 헤더(CSP는 의도적으로 생략 - HTML을 거의 서빙하지 않아 켜봤자 Swagger만 보호됨), 대신 실제 렌더링 표면인 frontend/admin에 Content-Security-Policy 적용(Vercel `headers`), Railway 뒤에서 정확한 클라이언트 IP를 위한 trust proxy, 로그인/회원가입 IP 기반 rate limiting(IP당 60초/10회, 초과 시 429)
- 서버 재시작 시에도 유지되는 사용자 세션
- 사용자 간 개인 채팅방
- 트랜잭션 안전한 메시지 저장 및 전달
- Redis 기반 세션으로 수평 확장 지원
- Google Gemini 2.5 Flash 기반 AI 채팅 (4가지 성격: 친절한 어시스턴트, 코드 도우미, 영어 선생님, 창의적인 작가)
- 커서 기반 메시지 히스토리 및 무한 스크롤
- 프로필 커스터마이징 - 계정 설정에서 설정하는 선택적 닉네임(고유값, 20자 이하)과 프로필 이미지(jpeg/png/webp, 2MB 이하)
- 채팅 UX 개선 - 메시지 입력창 포커스용 `/` 단축키, 닫을 수 있는 "빈 채팅" 안내, 클릭-홀드 배너 자동 스크롤, 모더레이션 알림용 aria-live 리전
- Admin 대시보드 - 유저/방 관리, 모더레이션 액션, 감사로그 CSV export를 위한 별도 앱([Admin 패널](#admin-패널) 참고)


## 아키텍처
### 프로젝트 구조
```
Chat Project/                   ← 모노레포 루트
├── backend/                    ← NestJS 애플리케이션
│   └── src/
│       ├── ai/                 ← Gemini AI (AiService, AiRoomService)
│       │   ├── constants/      ← system-prompts.ts, AI_USER_EMAIL
│       │   ├── entities/       ← AiRoomEntity (해당 방의 활성 AI 성격, RoomEntity에서 분리됨)
│       │   └── enums/          ← ai-personality.enum.ts
│       ├── audit-log/          ← AuditLogController, AuditLogService (권한 액션 감사 추적, CSV export)
│       │   └── dto/            ← AuditLogQueryDto, AuditLogExportQueryDto
│       ├── auth/               ← JWT 인증, 가드, 전략
│       │   ├── decorator/
│       │   ├── dto/
│       │   ├── guard/          ← JwtAuthGuard, RbacGuard, GraphqlAuthGuard
│       │   ├── interface/      ← Payload (JWT payload shape)
│       │   ├── role/
│       │   └── strategy/       ← passport-jwt
│       ├── base/
│       │   ├── entity/         ← EntityBase (생성/수정 타임스탬프)
│       │   ├── filter/         ← AllExceptionsFilter (HTTP+GraphQL 에러 응답 전역 정규화)
│       │   └── logger/         ← winston 로거
│       ├── chat/               ← ChatGateway, ChatService, ChatResolver
│       │   ├── decorator/      ← gql-query-runner.decorator
│       │   ├── entities/       ← ChatEntity, RoomEntity
│       │   │   └── dto/        ← CreateChatDto
│       │   ├── guard/          ← RateLimitGuard
│       │   └── interceptor/    ← GqlTransactionInterceptor
│       ├── graphql/            ← PubSubService, GraphQL 입력/반환 타입
│       ├── health/             ← HealthController (liveness probe, GET /health)
│       ├── mail/                ← MailService (SMTP 알림, 예: 역할 변경 이메일)
│       ├── migrations/         ← TypeORM 마이그레이션 파일
│       ├── mocks/              ← 테스트용 bcrypt 목
│       ├── moderation/         ← ModerationService, ModerationGuard (스트라이크 사다리, 밴/뮤트 적용)
│       │   ├── constants/      ← 임계값, 시스템 계정 이메일, 알림 문구, redis 키
│       │   └── enums/          ← moderation-status.enum.ts (active | banned)
│       ├── redis/              ← RedisModule, SessionCacheService
│       │   └── interface/      ← CachableMessage (graphql/pubsub.service.ts와 공유)
│       └── user/               ← UserController, UserService, UserEntity
│           ├── dto/
│           └── entities/
├── frontend/                   ← React + Vite 애플리케이션 (채팅 UI, 5173 포트)
│   └── src/
│       ├── api/                ← apollo.ts, axios.ts, graphql-operations.ts
│       ├── auth/               ← session-guard.ts (조용한 토큰 갱신, 탭 간 충돌 감지)
│       ├── components/         ← ProtectedRoute, AiPersonalitySelector, EmptyStateNotice, RateLimitNotice
│       ├── pages/               ← ChatPage, SigninPage, RegisterPage, AccountPage
│       ├── socket/              ← socket.ts (Socket.IO 싱글톤)
│       ├── store/                ← auth.store.ts (Zustand)
│       └── types/
└── admin/                       ← React + Vite admin 대시보드 (5174 포트) — Admin 패널 참고
    └── src/
        ├── api/                ← apollo.ts, axios.ts, graphql-operations.ts
        ├── auth/               ← session-guard.ts (조용한 토큰 갱신, 탭 간 충돌 감지)
        ├── components/         ← ProtectedRoute
        ├── pages/               ← LoginPage, DashboardPage, UsersPage, RoomsPage, LogsPage
        ├── store/                ← auth.store.ts (Zustand)
        └── test/                 ← Vitest 셋업 (jest-dom matcher, RTL cleanup)
```

### 하이브리드 저장소 패턴
- Redis(세션/캐시): 일관된 데이터 흐름과 서버 공유를 위해 `userId` => `socketId` 매핑 저장
- 인메모리(소켓): 쉬운 구현과 실시간 통신이 가능한 WebSocket 작업에 필요한 `socketId` => `Socket` 객체 저장
- 두 방식을 함께 쓰는 이유: Redis에는 직렬화된 객체가 'JSON' 형식으로 남지만, Socket 객체는 클라이언트가 TCP 연결을 유지하는 동안에만 존재합니다. 그래서 연결이 끊겨도 클라이언트는 Redis의 세션/캐시 데이터를 근거로 재연결할 수 있습니다.

### Redis Pub/Sub
- `RedisPubSub` 싱글톤 (`pubsub.service.ts`): GraphQL 뮤테이션과 활성 구독 간의 브리지 역할. 커밋 후 리졸버가 `receiveMessage :${roomId}` 채널에 발행하면, 연결된 모든 `receiveMessage` 구독자가 실시간으로 메시지를 수신합니다.
- `PubSubService.publish()`는 발행 시점에 부수효과로 `SessionCacheService.cacheMessage()`를 호출해 메시지를 캐싱합니다 — 사람 메시지와 AI 메시지 모두 동일하게, 메시지 캐싱이 일어나는 **유일한** 지점입니다. 리졸버나 `AiService`가 직접 `cacheMessage()`를 호출하지 않습니다.

### 엔티티 (TypeORM)
```
UserEntity
  id          PK
  email       unique
  nickname    nullable, unique, 최대 20자 — 다른 사용자에게 표시되는 이름
  profileImage nullable text (base64 data URI, jpeg/png/webp, 최대 ~2MB)
  password    API 응답에서 제외
  isAI        boolean (시드된 AI 시스템 계정에만 true)
  role        enum: user (0) | admin (1) | superadmin (2)
  status      enum: active | banned (모더레이션 상태, 모더레이션 섹션 참고)
  bannedUntil nullable timestamp — null이면 영구 밴 또는 밴 상태 아님
  chats    =< ChatEntity   (OneToMany)
  rooms    >< RoomEntity   (ManyToMany, RoomEntity 측 조인 테이블)

ChatEntity
  id          PK
  message     string
  participant >= UserEntity  (ManyToOne — 발신자)
  room        >= RoomEntity  (ManyToOne)

RoomEntity
  id            PK
  participants >< UserEntity   (ManyToMany 소유자, @JoinTable)
  chats        =< ChatEntity   (OneToMany)

AiRoomEntity — 관심사 분리와 더 깔끔한 관리를 위해 RoomEntity에서 분리됨
(자세한 이유는 ARCHITECTURE.md의 엔티티 절 참고)
  id          PK
  room        -- RoomEntity  (OneToOne, onDelete: CASCADE)
  personality string (해당 방의 현재 AI 성격)

EntityBase (네 엔티티 모두 상속)
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

### 인증 토큰 생명주기
두 토큰은 의도적으로 서로 다른 곳에 저장됩니다. 수명이 짧은 `accessToken`은 메모리에만
(Zustand, `persist`에서 제외), 수명이 긴 `refreshToken`은 JavaScript가 읽을 수 없는 백엔드 설정
httpOnly 쿠키에 보관합니다. 근거는 [ADR 0001](ADR/0001-jwt-auth-token-strategy.ko.md) 참고.

1. 로그인 — `POST /auth/signin` (Basic 인증)
  1.1. 백엔드가 응답 body로 `accessToken`을 반환하고, `refreshToken`은 httpOnly 쿠키로 설정
       (`secure`, `sameSite: 'none'` — 프론트엔드와 백엔드가 서로 다른 출처이기 때문)
  1.2. 프론트엔드는 `setTokens(accessToken, userId)` 호출; 토큰은 `localStorage`에 기록되지 않음

2. 인증된 요청
  2.1. `authLink`가 요청 시점에 `useAuthStore.getState().accessToken`을 읽어
       `Authorization: Bearer` 헤더 설정

3. 조용한 갱신 — 페이지 새로고침(메모리가 비어 있음) 또는 `errorLink`가 401을 감지했을 때
  3.1. 모든 호출 지점은 `refreshAccessTokenSafely()`(`session-guard.ts`)를 거치며, 동시 호출자는
       진행 중인 요청 하나를 공유
  3.2. `POST /auth/token/refreshaccess`를 `credentials: 'include'`로 전송 — 브라우저가 쿠키를
       자동 첨부하므로 JavaScript가 리프레시 토큰을 읽는 일이 없음
  3.3. 새 `accessToken`이 body로 돌아와 다시 메모리에 저장됨
  3.4. 갱신 결과가 이 탭이 마지막으로 인증했던 계정과 다르면
       (`sessionStorage['chat:sessionUserId']`), 조용히 신원을 바꾸는 대신 해당 탭을 로그아웃시킴

4. 로그아웃 — `POST /auth/signOut`
  4.1. 백엔드가 액세스 토큰을 블랙리스트에 등록하고 `res.clearCookie('refreshToken')` 호출 —
       토큰이 이미 만료됐거나 유효하지 않아도 쿠키는 삭제됨
  4.2. 프론트엔드는 Zustand 스토어를 비우고 리다이렉트


## 빌드
### 전체 설치
의존성 (37개)
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
- @socket.io/redis-adapter
- @types/bcrypt
- @types/passport-jwt
- bcrypt
- class-transformer
- class-validator
- cookie-parser
- dotenv
- graphql
- graphql-redis-subscriptions
- graphql-subscriptions
- ioredis
- joi
- jwt-decode
- nest-winston
- nodemailer
- passport
- passport-jwt
- pg
- socket.io
- socket.io-client
- tsconfig-paths
- typeorm
- winston

개발 의존성 (9개)
- @types/cookie-parser
- @types/nodemailer
- @types/supertest
- @types/winston
- cross-env
- source-map-support
- supertest
- ts-jest (커스텀 jest 설정)
- ts-loader

common, core, platform-express, testing, jest, eslint, prettier, ts-node, typescript 등의 NestJS CLI 기본 패키지는 제외.


### 설정
설치가 끝나면 `backend/src/app.module.ts`에서 패키지 설정을 진행합니다.

패키지
- joi
  - JavaScript 객체를 스키마 기준으로 검증하는 유효성 검사 패키지입니다.
  - `validationSchema`만으로는 자동 검증되지 않는 설정 값을 검증하는 데 사용합니다.

메서드
- join
  - 'path' 대신 'node:path'를 사용합니다: 같은 이름의 외부 패키지와 충돌을 막기 위해서입니다.
  - 경로 구분자를 OS에 맞게 처리하므로 크로스 플랫폼 호환성이 보장됩니다.

```ts
  import * as Joi from 'joi';

  @Module({
    imports: [
      // FYI : 정적 메서드 `forRoot`
      ConfigModule.forRoot({
      validationSchema: Joi.object({
        ENV: Joi.string().valid('dev', 'prod').required(),
        DB_TYPE: Joi.string().valid('postgres').required(),
        // ...나머지 필드는 DB/토큰/Redis/CORS/Gemini/mail/moderation 설정을 검증합니다 —
        // 전체 최신 변수 목록은 아래 환경 변수 설정 참고
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

이 목록은 로컬에서 서버를 부팅하는 데 필요한 핵심 변수만 다룹니다. 선택적 `MAIL_*` 변수
그룹(SMTP 알림 설정, [역할](#역할) 섹션의 역할 변경 이메일이 사용)과 `MODERATION_*` 그룹(스트라이크/밴
임계값, 전부 기본값 있음, [모더레이션](#모더레이션) 참고)을 포함한 전체 목록은
[backend/.env.example](backend/.env.example)을 참고하세요.


### 채팅
`ChatGateway`(`backend/src/chat/chat.gateway.ts`)는 연결 라이프사이클만 처리합니다 — 채팅 메시지용 `@SubscribeMessage`가 없고, 아무것도 emit하지 않습니다. 채팅 메시지는 대신 GraphQL Mutation/Subscription으로 오갑니다([흐름](#흐름) 참고). 이렇게 분리된 이유는 원래 메시지를 Socket.IO로 직접 전송하다가, 메시지 저장에 트랜잭션 보장(`GqlTransactionInterceptor`)을 주기 위해 프로젝트 중반에 GraphQL로 마이그레이션했기 때문입니다 — 단순 소켓 핸들러로는 이 보장을 줄 수 없었습니다.

**`handleConnection`** — 새 소켓마다:
1. 핸드셰이크의 `authorization` 헤더에서 JWT를 파싱(`authService.parseBearerToken`)
2. 토큰이 없거나 유효하지 않으면, **또는** `moderationService.isUserBanned()`가 true이면 연결 거부 — HTTP/GraphQL에서 `jwt.strategy`가 적용하는 것과 동일한 밴 게이트라서, 여전히 유효한 토큰이라도 소켓으로 연결해 밴을 우회할 수 없음
3. 성공하면 디코딩된 payload를 `client.data.user`에 저장하고, 소켓을 등록(`chatService.registerClient`)한 후 사용자가 속한 기존 방에 참여

**`handleDisconnect`** — 위 3단계에서 설정된 `client.data.user`를 읽어 `chatService.removeClient()`를 호출; 연결이 그 이전 단계에서 거부됐다면 정리할 것이 없으므로 두 핸들러는 대칭을 유지합니다.

**수평 확장**: `afterInit`이 Socket.IO 서버를 `@socket.io/redis-adapter`(Redis pub/sub 클라이언트 쌍)에 연결합니다 — 이게 없으면 `server.to(room).emit(...)`이 같은 프로세스에 연결된 클라이언트에게만 전달되어, 백엔드 인스턴스가 두 개 이상이 되는 순간 조용히 깨집니다.


### Docker 
#### 공개 - Dockerfile
무거운 `devDependencies`와 보안 취약점을 줄이기 위해 Multi-Stage 패턴을 사용합니다.
이 이미지를 빌드·배포하는 CI/CD 흐름은 [배포 → 공개 - Railway](#공개---railway)를 참고하세요.

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
redis-chat 컨테이너 시작/중지/제거 명령은 **배포 → 로컬 - Docker → Redis 컨테이너 사용법**을 참고하세요(두 곳에 중복해서 어긋나지 않도록 한곳에만 둡니다).


### 인증
- **Basic 인증** (`POST /auth/register`, `POST /auth/signin`) — email:password를 base64로 인코딩한
  `Authorization: Basic` 헤더로 보내며, Passport 전략 없이 `AuthService`가 직접 파싱·검증합니다.
- **JWT** (그 외 모든 보호된 라우트) — `passport-jwt`의 `JwtAuthGuard`
  (`backend/src/auth/strategy/jwt.strategy.ts`)로 검증하며, 액세스 토큰은 `Authorization: Bearer`
  헤더에 실립니다.
- `register`/`signin`은 둘 다 `AuthRateLimitGuard`로 레이트리밋됩니다([주요 엔드포인트](#주요-엔드포인트) 참고).


### 사용자
`UserController`/`UserService` — `UserEntity`에 대한 REST CRUD입니다. 전체 엔드포인트 목록은
[주요 엔드포인트](#주요-엔드포인트), 스키마는 [엔티티](#엔티티-typeorm), 역할·모더레이션 상태
동작은 [역할](#역할)/[모더레이션](#모더레이션)을 참고하세요.


### 역할
- 세 가지 역할: `user` (0, 기본값), `admin` (1), `superadmin` (2).
- 모든 가입 사용자는 `user` 역할을 부여받아 메시지 전송이 가능합니다.
- `admin` 역할은 상위 권한을 가지며, 모든 사용자 계정 조회·수정·삭제, 강제 로그아웃, 감사 로그 조회가 가능합니다.
- `superadmin` 역할은 역할 변경 권한을 추가로 보유합니다. 다른 사용자의 역할 승격·강등은 superadmin만 가능합니다.
- 최초 superadmin은 DB에 직접 INSERT하여 생성합니다. 이후 admin은 admin 패널에서 승격 가능합니다.
- `MAX_ADMIN_COUNT` 환경변수(기본값: 5)로 `admin` 역할 계정 수를 제한합니다. superadmin은 이 상한에 포함되지 않습니다.
- 역할이 변경될 때마다 `MailService`를 통해 대상 유저에게 이메일이 발송됩니다(non-blocking — 발송 실패는 로그만 남기고 역할 변경 자체를 막지 않음).

**서버측 불변식**(호출자와 무관하게 항상 강제되며, UI 제약이 아님):
- 마지막 남은 `superadmin`은 강등 불가 — `updateRole`이 차단해 시스템이 superadmin 0명 상태가 되는 것을 방지
- `admin` 역할 계정은 `MAX_ADMIN_COUNT` 상한
- 시딩된 AI 답장 계정과 moderation 시스템 계정은 삭제 불가 — `UserService.remove()`가 거부(AI 답장 또는 모더레이션 알림 기능이 조용히 깨지는 것을 방지)


### 모더레이션
자동으로 에스컬레이션되고 admin이 되돌릴 수 있는 행동 기반 어뷰징 탐지 시스템입니다. `sendMessage` 경로와 auth/socket 계층에서 동작하며 별도의 신고 UI는 없습니다. 탐지·누적·집행 로직은 모두 `ModerationService`에 있고, 얇은 `ModerationGuard`가 뮤트/밴된 사용자를 `sendMessage`에서 걸러냅니다.

- **스트라이크 소스**
  - *중복/도배* — 동일한 메시지(정규화됨)를 60초 내에 3회 전송하면 스트라이크 1회 추가
  - *속도* — `RateLimitGuard`(10건/15초)에 걸리면 스트라이크 1회 추가(동일 가중치)
- **에스컬레이션 사다리** — 스트라이크는 24시간 롤링 윈도우 내에서 누적됩니다(모든 임계값은 env로 조정 가능):
  - **3 스트라이크 → 경고** — 방에 System 계정 메시지가 게시됨(가운데 정렬된 알림으로 렌더링)
  - **5 스트라이크 → 임시 뮤트** — 10분, Redis 기반; 연결은 유지되지만 전송 불가
  - **7 스트라이크 → 기간제 밴** — 7일; 재범(두 번째 `USER_BANNED`)은 **영구** 밴이 됨
- **집행** — 밴된 사용자는 `jwt.strategy`(HTTP/GraphQL), `handleConnection`(소켓), 토큰 갱신 시점에서 모두 거부되어, 여전히 유효한 세션이라도 밴을 우회할 수 없습니다. 뮤트는 전송만 차단합니다.
- **복구 및 감사** — `POST /user/:id/unban`(admin)이 밴/뮤트/스트라이크를 해제하고 auth 캐시를 무효화합니다. 모든 액션은 감사 로그 항목(`USER_MUTED` / `USER_BANNED` / `USER_UNBAN`)을 남깁니다.
- **저장소** — `user_entity.status`(`active` | `banned`)와 `bannedUntil`이 영구 밴을 뒷받침하고, 스트라이크와 뮤트는 Redis 전용(`moderation:*` 키, 전부 TTL 있음)입니다. 시작 전 `AddModerationColumns` 마이그레이션을 실행하세요.

조정 가능한 env var(선택; 합리적인 기본값 적용됨): `MODERATION_STRIKE_WINDOW_SEC`, `MODERATION_WARN_THRESHOLD`, `MODERATION_MUTE_THRESHOLD`, `MODERATION_MUTE_DURATION_SEC`, `MODERATION_BAN_THRESHOLD`, `MODERATION_BAN_DURATION_SEC`, `MODERATION_DUP_WINDOW_SEC`, `MODERATION_DUP_THRESHOLD`.

> 이 절에 인용된 기본값은 네 곳(여기, CLAUDE.md, `backend/.env.example`, 코드)에 중복되어 있습니다. `backend/src/moderation/constants/moderation.constants.ts`의 `MODERATION_DEFAULTS`가 단일 진실 공급원이므로, 값을 바꿀 때는 그곳을 먼저 수정한 뒤 나머지 세 곳을 다시 동기화하세요.

**감사 로그 액션 값** — 모든 권한 액션은 아래 중 하나를 감사 기록에 남깁니다(`GET /audit-log?action=`으로 필터 가능, [주요 엔드포인트](#주요-엔드포인트) 참고):

| 액션 | 기록 주체 |
|---|---|
| `ROLE_CHANGE` | `PATCH /user/:id/role` |
| `FORCE_LOGOUT` | `POST /user/:id/force-logout`, 또는 수동/기간제 밴 시 자동 |
| `USER_DELETE` | `DELETE /user/:id` |
| `USER_BANNED` | 자동 밴 임계값 도달, 또는 `POST /user/:id/ban` |
| `USER_MUTED` | 자동 뮤트 임계값 도달 |
| `USER_UNBAN` | `POST /user/:id/unban` |


#### 수동 E2E 검증 (개발자 인수인계용)

이 부분은 자동화된 E2E로 커버되지 않습니다(유닛 테스트만 있음). 세 계정 — **A**(위반자),
**B**(수신자), **admin** — 으로 검증하세요. 상위 단계에 빨리 도달하려면 `.env`에서 임계값을
일시적으로 낮추되, 값들은 반드시 서로 다르게(`warn < mute < ban`) 유지해야 합니다. 값이 겹치면
`escalate()`의 정확히-일치 검사가 충돌합니다. 예: `MODERATION_WARN_THRESHOLD=2`,
`MODERATION_MUTE_THRESHOLD=3`, `MODERATION_BAN_THRESHOLD=4`, `MODERATION_MUTE_DURATION_SEC=30`.
백엔드를 재시작해 적용하고, 검증이 끝나면 원래 값으로 되돌리세요.

1. **경고** — A에서 B에게 *동일한* 메시지를 반복 전송(`DUP_WINDOW` 이내, rate limit 이하). warn
   임계값에서 방에 가운데 정렬된 System 계정 알림이 나타남; 새로고침해도 유지됨(저장된
   `ChatEntity`이기 때문).
2. **뮤트** — 계속 전송. mute 임계값에서 A의 다음 전송이 거부됨(`ModerationGuard` → FORBIDDEN,
   프론트엔드가 뮤트 알림 표시); A는 연결은 유지되고 B의 메시지를 계속 *수신*함. 참고: 뮤트
   상태에서는 `sendMessage`가 가드에서 차단되므로 뮤트가 풀릴 때까지 **추가 스트라이크가
   쌓이지 않습니다**.
3. **기간제 밴(자동)** — 뮤트가 풀린 후 다시 도배해 ban 임계값을 넘김. 예상: A는 즉시 연결
   종료됨; 재연결은 `handleConnection`에서 거부됨; 토큰 갱신도 거부됨 — 여전히 유효한
   액세스 토큰이라도 우회 불가. `bannedUntil`이 지나면 A는 다시 앱을 사용할 수 있음.
4. **수동 밴(admin)** — A에 `POST /user/:id/ban` → 즉시 세션 종료(`forceLogout` 재사용)와
   자동 밴과 동일한 auth 계층 거부.
5. **언밴(admin)** — A에 `POST /user/:id/unban` → `status`가 `active`로 복구, 스트라이크/뮤트
   해제, auth 캐시 무효화; A는 즉시 다시 전송 가능.
6. **감사** — 위 각 단계는 admin이 볼 수 있는 감사 로그 항목(`USER_MUTED` / `USER_BANNED` /
   `USER_UNBAN`)을 남깁니다.

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


### Admin 패널
admin/superadmin 계정용 별도 React 앱(`admin/`)으로, 로컬에서는 `http://localhost:5174`([빠른 시작](#빠른-시작) 참고)에서 실행되고 자체 Vercel 프로젝트로 배포됩니다([Admin 패널 - Vercel](#admin-패널---vercel) 참고).

- **Dashboard** — 총 유저 수(`humanOnly`, AI 계정과 moderation 시스템 계정 제외), 총 방 수, 현재 접속자 수, 최근 감사 로그 5건
- **Users** — 페이지네이션/정렬/검색 지원 목록; 모더레이션 상태(active/banned)로 필터. 행을 클릭하면 모더레이션 상태와 최근 감사 이력을 담은 상세 패널이 열림. 액션: 승격/강등(superadmin 전용), 강제 로그아웃, 수동 밴(선택적 사유, 영구 또는 기간제)/언밴, 삭제 — 자신보다 명확히 낮은 등급만 대상 가능하며 AI/moderation 시스템 계정은 절대 삭제 불가([역할](#역할) 불변식 참고)
- **Rooms** — 페이지네이션/검색 지원 목록; 행을 클릭하면 상세 패널(방 ID, 생성일, 참여자)이 열림. 방 삭제 가능
- **Logs** — 액션/유저/날짜 범위로 필터한 감사 로그; **Export CSV**는 현재 필터를 파일로 다운로드(API와 동일하게 10,000행 캡)


### Redis
- Redis가 없다면 연결 상태(`socketId`, 온라인 상태)는 각 프로세스 자체 메모리에만 존재합니다 — 단일 인스턴스에서는 문제없지만, 확장되어 인스턴스가 여러 개가 되는 순간 다른 인스턴스에서는 전혀 보이지 않습니다. Redis는 이 메타데이터를 중앙에서 저장해 어떤 인스턴스에서든 사용자가 어디에 연결되어 있는지 조회할 수 있게 하며, 동시에 메시지 캐시와 pub/sub 브릿지 역할도 겸합니다(위 참고).

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
- AI 응답 전문이 사람 메시지와 동일한 `receiveMessage :${roomId}` GraphQL Pub/Sub 채널을 통해 단일 메시지로 전달 — 별도의 Socket.IO/WebSocket 브로드캐스트는 없음

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
테스트 성공률과 함께 코드가 얼마나 검증됐는지 보려면 커버리지 리포트가 유용합니다.

#### 설정
- 유닛 테스트

테스트 코드는 `spec.ts` 파일에 정의되어 있고 바로 실행할 수 있습니다.

테스트 디렉터리는 상대 경로 `src` 대신 별도의 루트 배열 `["src"]`로 지정합니다('Package.json' 기준).

배열로 지정해 두면 나중에 e2e 테스트 같은 추가 테스트 위치를 붙이기 쉽습니다.

**단일 기본 디렉터리**
```json
"jest": {
  "rootDir": "src",
}
```

**다중 기본 디렉터리**
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
  "ai-personality.enum.ts",
  "all-exceptions.filter.ts"
],
```

- 디렉터리 루트
'Package.json'에서 커버리지 리포트 출력 위치를 설정 파일의 상위 디렉터리로 지정하면, 모든 테스트 파일을 한 번에 돌리고 결과를 한곳에서 볼 수 있습니다.
  - 하위 저장소
  ```json
    "coverageDirectory": "../coverage",
  ```

  - 상위 저장소
  ```json
    "coverageDirectory": "./coverage",
  ```

- 모듈명 매퍼
'Package.json'에서 정규식으로 모듈 임포트 경로를 매핑합니다. 예를 들어 `src/utils`를 `<rootDir>/src/utils`로 해석하게 합니다.
```json
"moduleNameMapper": {
  "src/(.*)": "<rootDir>/src/$1"
}
```

#### 테스트 커버리지
**테스트 결과**
- Test Suites: 12 passed, 12 total

**커버리지 결과** (% Stmts 기준, `pnpm test:cov` — 2026-07-16 기준)
- Auth Service: 98.29%
- Chat Service: 97.72%
- Redis Service: 96.34%
- User Service: 100%
- AI Service: 96.7%
- AI Room Service: 100%
- Moderation Service: 99.21%
- Audit Log Service: 97.56%
- Mail Service: 100%

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


#### Migration Cascade Guard

`migration-cascade-guard.spec.ts`는 정적 가드입니다(런타임 유닛 테스트가 아니라 마이그레이션
소스에 대한 텍스트 스캔) — CASCADE가 도입된 시점 **이후**에 생성된 마이그레이션이 cascade에
필수적인 FK를 잘못된 `ON DELETE` 액션으로 다시 추가하면 빌드를 실패시킵니다.

**보호 대상.** `migration:generate`는 ManyToMany 조인 테이블 FK인
`FK_501a0aef55632e3cf2894bda97f`(`room_entity_participants_user_entity`)를 조용히
`ON DELETE NO ACTION`으로 재생성해, `UserService.remove`가 삭제된 유저의 방 참여 기록을
정리하는 데 의존하는 `ON DELETE CASCADE`를 되돌려버립니다. 이 가드는 각 마이그레이션의
`up()`만 스캔합니다 — `down()`이 이전 액션을 복원하는 것은 정당하므로 — 그리고 CASCADE가
유지되어야 함을 요구합니다. 이전 마이그레이션(원래 `NO ACTION`을 설정한 것들)은 `since`
타임스탬프로 예외 처리되어, 최초 `InitialSchema`는 걸리지 않습니다.

**왜 `pnpm test`에 얹혀있는가.** lint도 이제 blocking CI 단계이지만, 문법/스타일만 검사할 뿐
마이그레이션 간 FK 이력은 검사하지 않습니다 — 그래서 이 가드는 대신 테스트 스위트에 얹혀
두 지점에서 발동합니다:

| 발동 지점 | 효과 |
|---|---|
| 로컬 `pnpm test`(dev 브랜치) | 가장 이른 포착 — 잘못된 마이그레이션이 생성되고 개발자가 테스트를 돌리는 순간 |
| CI `test` job(main push/PR) | Blocking; `deploy`가 `needs: test`이므로 위반 시 Railway 프로덕션 배포가 막힘 |

의도적으로 프로덕션에서는 실행하지 **않습니다**: 프로덕션 부팅 시점에는 이미 `migration:run`이
라이브 DB에 해당 마이그레이션을 실행한 뒤이므로, 그 시점의 소스 스캔은 너무 늦습니다 — 데이터
손상을 부팅 장애로 바꾸는 것밖에 안 됩니다. 올바른 포착 지점은 로컬 + CI입니다. 확장하려면
spec의 `GUARDED_FKS` 배열에 항목을 추가하세요.

### 배포
#### 프론트엔드 - Vercel
**라이브 데모**
- 라이브 URL: https://chat-project-frontend-ten.vercel.app

**CI/CD 흐름**
`git push origin main` => Vercel 자동 배포

**설정**
- 루트 디렉터리: `frontend/`
- 모노레포 패키지 해석을 위한 `pnpm-workspace.yaml`


#### Admin 패널 - Vercel
frontend와 동일한 패턴으로 **별도 Vercel 프로젝트**로 배포됩니다. GitHub Actions와는 무관하며, Vercel이 push 시 독립적으로 빌드·배포합니다.

**CI/CD 흐름**
`git push origin main` => Vercel 자동 배포

**설정**
- 루트 디렉터리: `admin/`
- 모노레포 패키지 해석을 위한 `pnpm-workspace.yaml`
- 환경변수: `VITE_API_URL` (frontend와 동일한 백엔드)


#### 공개 - Railway
**라이브 데모**
- 라이브 URL: https://chat-project-production-3b22.up.railway.app

**CI/CD 흐름**
`git push origin main` => GitHub Actions (`test` → `e2e` + `admin-e2e` → `deploy`) => Railway CLI
=> 자동 배포 — 전체 CI job 구성은 [CONTRIBUTING.md](CONTRIBUTING.md#before-submitting-a-pr) 참고

**설정 (최초 1회)**
1. GitHub => Settings => Secrets => Actions에 `RAILWAY_TOKEN` 추가
2. Railway Dashboard => Variables 탭에 `.env` 변수 설정
3. Railway에 Redis 플러그인 추가 (로컬 Docker Redis 대체)

**설정 파일**
- 'railway.toml': Dockerfile로 빌드, 배포 시 `cd backend && pnpm migration:run && node dist/main` 실행


#### 로컬 - Docker
Docker를 사용하여 Redis 서버 배포 및 실행

- Redis 컨테이너 실행
`docker run -d -p 6379:6379 --name redis-chat redis:latest`

- 'redis-chat' 컨테이너 확인
`docker ps`

- Redis 연결 확인
`docker exec -it redis-chat redis-cli ping` => PONG


#### Redis 컨테이너 사용법
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

이런 종류의 문제에 대한 전체 근본원인 서사(한 줄 요약이 아니라)는 아래 [AI 보조 개발 사례](#ai-보조-개발-사례)를 참고하세요.


## 향후 확장 계획
[ROADMAP.ko.md](ROADMAP.ko.md)로 옮겼습니다.


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
`AiService`가 자신의 응답을 직접 캐싱하고, `PubSubService`의 발행 시점 훅이 같은 응답을 한 번 더
캐싱하고 있었습니다. 문제는 두 번째 캐싱에 넘어간 값이 `plainToClass`로 직렬화된 사본이라,
`@Exclude()`가 붙은 `created` 필드가 이미 제거된 상태였다는 점입니다. 이 손상된 캐시 항목은
이후 `getCachedMessages`를 거치며 `new Date(undefined)`(유효한 `Date` 인스턴스지만 내부적으로
`NaN`)가 되었고, 캐시에서 읽은 `getMessages` 응답에 그 항목이 포함되는 순간 GraphQL의 기본
`DateTime` 스칼라(`value.toISOString()`)가 크래시했습니다.

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


## 관련 문서
- [ARCHITECTURE.md](ARCHITECTURE.md) — 모듈 의존성 그래프, 가드 체인, 배포 토폴로지
- [CONTRIBUTING.md](CONTRIBUTING.md) — 로컬 설정, 브랜치/커밋 컨벤션, PR 체크리스트
- [CHANGELOG.md](CHANGELOG.md) — 전체 커밋 이력
- [ADR/](ADR/) — 아키텍처 결정 기록(영문 전용)
- [아키텍처 다이어그램](https://claude.ai/code/artifact/29b14132-8dd8-4b1b-bb28-f21d3ab27b44) — 인증,
  `sendMessage`, 소켓, AI, 모더레이션, Redis, 가드, 모듈 등 코드 검증 기반 다이어그램 14종(private
  링크, 저장소 내 다른 곳에는 색인되어 있지 않음)


## 라이선스
MIT — [LICENSE](LICENSE) 참고.
