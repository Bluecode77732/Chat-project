# 아키텍처 결정 기록 (Architecture Decision Records)

> English version: [README.md](README.md)

이 디렉터리는 [CLAUDE.md의 Architecture Decisions 절](../CLAUDE.md#architecture-decisions)에 이미
요약되어 있는 결정들을, 각각 인용 가능한 개별 기록으로 정식화합니다. AI 에이전트 행동 규칙("이건
절대 제안하지 마라")에 대한 단일 진실 공급원은 여전히 CLAUDE.md이며, 이 디렉터리의 파일들은 각
결정이 CLAUDE.md를 비대하게 만들지 않으면서도 자신만의 배경/근거 흐름을 갖도록 하기 위해
존재합니다.

## 형식

각 ADR은 동일한 네 개 절로 구성됩니다: **Status**(상태), **Context**(문제/제약 조건),
**Decision**(무엇을 선택했는지 — 그리고 어떤 선택지가 함께 검토됐고 왜 탈락했는지를 밝히는
"고려했다가 배제한 대안" 블록 포함), **Consequences**(그 선택이 앞으로 무엇을 요구하는지, 그리고
대신 제안하면 안 되는 것들 포함). 각 ADR은 동일한 번호에 `.ko.md` 접미사가 붙은 한국어 번역을
가지고 있습니다(예: [0001-jwt-auth-token-strategy.ko.md](0001-jwt-auth-token-strategy.ko.md)).

이 기록들은 Nygard식 최소 한 장짜리 ADR이 **아니며**, 형식을 "가볍다"고 표현해서도 안 됩니다:
여기 있는 기록은 40~90줄 분량인데, file:line 인용, 명시적으로 배제된 대안, 그리고 사람뿐 아니라 AI
에이전트를 겨냥한 "이건 절대 제안하지 마라" 가드레일을 함께 담기 때문입니다. 이 장황함은 의도적으로
받아들인 트레이드오프입니다 — 기록을 길게 만드는 바로 그 디테일이 `pnpm check:adr`로 검증 가능하게
하고, 사전 지식 없이 읽는 에이전트가 바로 실행에 옮길 수 있게 해줍니다.

소스 인용은 백틱으로 감싼 `file.ts:NN` 형식을 씁니다(단일 줄, 범위 `NN-MM`, 콤마로 나열한
`NN,MM,KK` 모두 가능). 인용 근처에 어떤 심볼/호출을 가리키는지 백틱으로 이름을 밝혀두세요(이미
이 문서군의 일반적인 문체이지, 새로 생긴 요구사항은 아닙니다) -- `scripts/check-adr-integrity.mjs`
(`pnpm check:adr`)가 인용된 위치 근처에 그 심볼이 실제로 있는지 대조해서, 없으면 경고를 냅니다
(빌드를 막지는 않습니다 -- 휴리스틱이라 감싸는 클래스 이름만 언급된 경우 오탐이 날 수 있어서입니다).
인용 자체의 존재/범위 오류(파일 없음, 줄 번호 초과)는 빌드를 막습니다. 단순 존재 체크로는 왜
부족했는지는 스크립트 자신의 헤더 주석을 참고하세요 -- 같은 세션 안에서 존재 체크를 두 번이나
통과한 채 stale 인용이 남아있었던 사례 때문에 만들어졌습니다.

같은 스크립트가 번호 일관성 오류 두 가지도 빌드를 막는 에러로 잡습니다(`ADR/`, `CLAUDE.md`,
`ARCHITECTURE.md`/`.ko.md` 전체 대상): 링크 텍스트와 경로의 번호가 어긋난 ADR 링크
(`[ADR 0016](0007-....md)` -- 보통 링크를 복사한 뒤 한쪽만 고쳐서 생깁니다), 그리고 파일명 번호와
자신의 `# NNNN:` 제목 번호가 어긋난 ADR. 두 검사 모두 깨끗한 실행 결과를 그대로 믿지 않고, 각
실패 유형을 일부러 심어서 실제로 잡히는지 확인했습니다.

## 상태(Status) 생명주기

현재 모든 기록이 `Accepted`이고 아직 뒤집힌 결정은 하나도 없습니다 — 그래서 아래 절차는 실제
사례에서 도출한 게 아니라 미리 정해둔 것입니다.

- **`Accepted`** — 결정이 유효하며 코드가 그것을 반영하고 있습니다.
- **`Superseded by NNNN`** — 이후의 ADR이 이 결정을 대체했습니다. **기존 ADR의 Decision을 뒤집힌
  내용으로 고쳐 쓰면 절대 안 됩니다.** 새 결정을 담은 새 ADR을 쓰고 거기서 옛 번호를 링크한 다음,
  옛 기록에서는 Status 줄만 `Superseded by NNNN`으로 바꾸고 같은 링크를 덧붙입니다. 대체된 파일의
  나머지는 그대로 둡니다 — 그 기록의 존재 이유가 "그 시점에 무엇을 옳다고 믿었는지"를 담는 것인데,
  그걸 고쳐버리면 파일이 존재하는 이유인 역사 자체가 사라집니다.
- **`Deprecated`** — 결정이 더 이상 적용되지 않지만 대체한 것도 없는 경우(예: 그 결정이 관장하던
  기능이 제거됨). 같은 규칙 — Status 줄만 바꾸고 본문은 그대로 둡니다.

따라서 결정이 뒤집히면 항상 두 군데를 고치게 됩니다(새 ADR + 옛 Status 줄), `.md`와 `.ko.md` 양쪽
모두에서. 그리고 두 목차 표의 상태 칼럼도 함께 갱신해야 합니다.

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
| [0018](0018-railway-volume-log-persistence.ko.md) | Railway 볼륨을 붙여 재배포 후에도 로그를 보존 | Accepted |
| [0019](0019-sentry-error-tracking.ko.md) | Sentry를 통한 backend 에러 트래킹 (5xx만) | Accepted |
| [0020](0020-security-headers-and-auth-rate-limit.ko.md) | 보안 헤더 분리(Helmet은 backend / CSP는 frontend+admin)와 IP 기반 인증 레이트리밋 | Accepted |
| [0021](0021-unified-message-delivery-channel.ko.md) | 사람·AI·모더레이션 시스템 메시지의 단일 전달 채널/형태 | Accepted |

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
심각도가 낮다고 판단해 리팩터링 대신 문서화만 진행했습니다. 0018은 같은 backend 에러 로깅의 지속성을 점검하는 후속 작업에서 나온 결정입니다 — 로그 휘발성 문제 해결과, 죽어 있던 `isVercel` 분기 제거를 함께 진행했습니다(문서화 전용 작업이 아님). 0019는 0018을 낳은 동일한 관측 가능성 재검토에서 이어진 것입니다 — 메트릭/트레이싱/APM이 완전히 부재함을 확인했지만, 사용자가 명시적으로 범위를 좁힌 뒤 backend 전용 에러 트래킹(Sentry)으로만 축소했습니다. 메트릭, 트레이싱, frontend/admin 커버리지는 여전히 보류 상태입니다. 0020과 0021은 모든 ADR을 현재 구현과 전면 대조하는 감사에서 나왔습니다 — 0020은 README 한 줄로만 있던 보안 헤더/레이트리밋 설계를 정식화한 것이고, 0021은 원래 AI 답장에만 국한됐던 CLAUDE.md 원칙을, 실제 구현(모더레이션 시스템 메시지)이 두 번째로 생긴 지금 ADR로 승격한 것입니다.
