# 아키텍처 결정 기록 (Architecture Decision Records)

> English version: [README.md](README.md)

이 디렉터리는 [CLAUDE.md의 Architecture Decisions 절](../CLAUDE.md#architecture-decisions)에 이미
요약되어 있는 결정들을, 각각 인용 가능한 개별 기록으로 정식화합니다. AI 에이전트 행동 규칙("이건
절대 제안하지 마라")에 대한 단일 진실 공급원은 여전히 CLAUDE.md이며, 이 디렉터리의 파일들은 각
결정이 CLAUDE.md를 비대하게 만들지 않으면서도 자신만의 배경/근거 흐름을 갖도록 하기 위해
존재합니다.

## 형식

각 ADR은 가벼운 구조를 따릅니다: **Status**(상태), **Context**(문제/제약 조건),
**Decision**(무엇을 선택했는지), **Consequences**(그 선택이 앞으로 무엇을 요구하는지, 그리고
대신 제안하면 안 되는 것들 포함). 각 ADR은 동일한 번호에 `.ko.md` 접미사가 붙은 한국어 번역을
가지고 있습니다(예: [0001-jwt-auth-token-strategy.ko.md](0001-jwt-auth-token-strategy.ko.md)).

## 목차

| # | 제목 | 상태 |
|---|---|---|
| [0001](0001-jwt-auth-token-strategy.ko.md) | JWT 액세스/리프레시 토큰 분리 | Accepted |
| [0002](0002-redis-cache-conventions.ko.md) | ioredis를 통한 Redis 캐시 키/TTL 컨벤션 | Accepted |
| [0003](0003-database-transaction-strategy.ko.md) | PostgreSQL + TypeORM 트랜잭션 전략 | Accepted |
| [0004](0004-graphql-socketio-api-layer-split.ko.md) | 데이터는 GraphQL, 연결 생명주기는 Socket.IO 전용 | Accepted |
| [0005](0005-cors-multi-origin-policy.ko.md) | 환경변수 하나로 관리하는 CORS 멀티 오리진 허용 목록 | Accepted |
| [0006](0006-moderation-one-directional-dependency.ko.md) | ModerationModule의 단방향 의존성 | Accepted |
| [0007](0007-ai-reply-distributed-lock.ko.md) | AI 답장 생성을 위한 룸 단위 분산 락 | Accepted |
| [0008](0008-pnpm-monorepo-layout.ko.md) | pnpm 워크스페이스 모노레포 (backend/frontend/admin) | Accepted |
| [0009](0009-admin-separate-app.ko.md) | admin 대시보드를 완전히 별도 앱으로 분리 (`frontend`의 라우트가 아님) | Accepted |
| [0010](0010-railway-vercel-deployment.ko.md) | 배포는 Railway(backend) + Vercel(frontend, admin) | Accepted |
| [0011](0011-gemini-ai-provider.ko.md) | AI 답장 제공자로 Google Gemini 선택 | Accepted |
| [0012](0012-airoomentity-split.ko.md) | `RoomEntity`에서 `AiRoomEntity`를 분리 | Accepted |
| [0013](0013-local-dev-network-binding.ko.md) | 로컬 개발 서비스는 127.0.0.1에만 바인딩하고 Redis는 인증을 요구 | Accepted |
| [0014](0014-single-active-session.ko.md) | 사용자당 활성 세션 하나만 유지 (이전 소켓 자동 축출) | Accepted |
| [0015](0015-audit-trail-privileged-actions.ko.md) | 모든 권한 있는 작업/제재 조치에 대한 감사 로그 | Accepted |
| [0016](0016-redis-unavailability-policy.ko.md) | Redis 장애 시 정책: 보안 체크는 fail-closed, 캐시는 DB로 저하 | Accepted |
| [0017](0017-auth-user-chat-circular-dependency.ko.md) | forwardRef를 통한 AuthModule ↔ UserModule ↔ ChatModule 순환 의존성 | Accepted |

범위 참고: 0001–0005는 CLAUDE.md에 이미 서술되어 있던 결정을 정식화한 것이고, 0006–0007은 소스
파일의 인라인 주석으로만 존재하던 코드 레벨 근거를 정식화한 것입니다. 0008, 0010, 0012, 0013은
ARCHITECTURE.md나 README.md에만 문서화되어 있던 결정으로 범위를 확장한 것이고, 0014–0015는
CLAUDE.md의 Project-Specific Principles에 이미 서술된 근거를 정식화한 것입니다. 0009와 0011은
이번 작업 이전에는 코드나 기존 문서 어디에도 기록되어 있지 않았던 내용이라, 개발자와의 새로운
인터뷰가 필요했습니다 — admin 앱 분리의 동기, 그리고 Gemini 선택의 동기입니다. 0016은 기존 ADR
세트 자체를 재검토하는 과정에서 발견하고 그 자리에서 결정·구현한 정책입니다 — JWT 블랙리스트 체크,
user_cache 읽기/쓰기, 뮤트 체크 3곳은 기존 RateLimitGuard와 달리 에러 처리가 전혀 없었고, 수정과
ADR 작성을 함께 진행했습니다(문서화 전용 작업이 아님). 0017은 같은 재검토 과정에서 나온
관련 발견 하나를 다룹니다 — AuthModule, UserModule, ChatModule 사이의 부팅 순서 순환 의존성이며,
심각도가 낮다고 판단해 리팩터링 대신 문서화만 진행했습니다.
