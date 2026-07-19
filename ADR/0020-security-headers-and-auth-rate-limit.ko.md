# 0020: 보안 헤더 분리(Helmet은 backend / CSP는 frontend+admin)와 IP 기반 인증 레이트리밋

## 상태

Accepted

## 배경

세 배포 단위는 렌더링 표면이 완전히 다릅니다: `backend`는 HTML을 거의 서빙하지 않고(REST/GraphQL은
JSON 전용, `/document`의 Swagger UI만 예외), 실제로 브라우저가 렌더링하는 페이지는 `frontend`/`admin`
쪽입니다 — `ChatEntity.message`를 통한 저장형 XSS(CLAUDE.md의
[Render-Surface Sanitization](../CLAUDE.md#chat--caching) 참고)나 클릭재킹이 실제로 발생할 수 있는
지점도 거기입니다. 별개로, `POST /auth/signin`과 `POST /auth/register`는 아직 인증된 `userId`가 없어서
레이트리밋을 걸 기준이 없습니다 — 기존 `RateLimitGuard`(사용자별,
[ADR 0016](0016-redis-unavailability-policy.ko.md))를 이 인증 전 단계에 그대로 재사용할 수 없었지만,
이 두 엔드포인트에 대한 크리덴셜 스터핑/무차별 대입 공격은 여전히 속도 제한이 필요했습니다.

## 결정

- **Helmet**(`helmet@^8.3.0`)을 `app.use(helmet({ contentSecurityPolicy: false }))`(`main.ts:37`)로
  백엔드 전역에 적용해서, Helmet의 나머지 기본 보호(`X-Frame-Options`, `X-Content-Type-Options` 등)는
  받으면서 Helmet 자체의 CSP 생성은 명시적으로 끕니다 — `backend`에 CSP 헤더를 걸어봤자
  `/document`(Swagger)만 보호하는데, Swagger는 어차피 인라인 스크립트에 대해 광범위한 예외가
  필요해서 CSP의 의미가 퇴색되고, 실제 XSS 관련 표면(다른 오리진)은 이 헤더로 애초에 보호할 수
  없습니다.
- **CSP는 대신 `frontend`/`admin`에 적용**합니다 — 백엔드 응답 헤더가 아니라 각 앱의 정적 Vercel
  `headers` 설정(`frontend/vercel.json`, `admin/vercel.json`)을 통해서인데, 실제 렌더링이 일어나는
  곳이 거기이기 때문입니다. 두 정책은 서로 다릅니다: `frontend`엔 `style-src 'self' 'unsafe-inline'`이
  있고 `admin`엔 없습니다 — 두 앱 모두 같은 스타일링 스택(Tailwind, `package.json`으로 확인)을
  쓰지만, React 인라인 `style={{...}}` prop을 쓰는 곳은 `frontend/src/pages/chat-page.tsx` 하나뿐이고
  (이건 인라인 `style` 속성으로 렌더링되는데, CSP의 `style-src`는 `'unsafe-inline'`이나
  nonce/hash 없이는 이걸 막습니다), `admin`에는 그런 사용처가 전혀 없어서 그쪽 정책이 어딘가에
  명시적으로 기록된 결정이 아니라 결과적으로 더 엄격해진 것입니다.
- `app.set('trust proxy', 1)`(`main.ts:29`)은 정확히 바로 앞 리버스 프록시(Railway) 한 단계만
  신뢰합니다 — `req.ip`가 Railway 프록시 자신의 주소 대신 실제 클라이언트 IP로 해석되게 하며, 이게
  없으면 모든 클라이언트가 하나의 공유 레이트리밋 버킷으로 뭉개져 버리기 때문에 다음 항목의 전제가
  됩니다.
- `AuthRateLimitGuard`(`backend/src/auth/guard/auth-rate-limit.guard.ts`)는 `signin`/`register`를
  클라이언트 IP 기준으로(인증 전이라 `userId`를 쓸 수 없어서) 레이트리밋합니다: `auth:{handler}-attempt:{ip}`
  키로 60초 창에 10회 — `RateLimitGuard`와 동일한 원자적 `INCR`+조건부 `EXPIRE` Lua 패턴과 Redis
  에러 시 fail-closed 처리를 그대로 재사용합니다. 가드 하나 더 추가한다고 새 의존성(예:
  `@nestjs/throttler`)을 들이는 대신, 이미 확립된 손수 구현 패턴을 재사용한 것입니다.

## 결과

- `frontend`/`admin`의 CSP 비대칭(`style-src 'unsafe-inline'`이 `frontend`에만 있음)은 지금은
  어딘가에 명시적으로 기록된 정책이 아니라, 우연히 어느 앱이 인라인 `style` prop을 쓰느냐의
  부산물입니다 — 나중에 `admin`이 인라인 스타일을 쓰는 컴포넌트를 추가하면, 누군가 알아채고
  `admin/vercel.json`을 고치기 전까지는 CSP가 조용히 그걸 막아버립니다. 반대로 `chat-page.tsx`의
  인라인 스타일이 나중에 제거되면, `frontend/vercel.json`도 `admin`의 더 엄격한 정책에 맞춰 조여야
  합니다.
- `trust proxy`를 `1`로 둔 것(`true`나 무제한이 아니라)은 의도적입니다 — 전체 `X-Forwarded-For`
  체인을 신뢰하면 클라이언트가 가짜 헤더 값으로 자기 IP를 위조할 수 있게 되어
  `AuthRateLimitGuard`가 완전히 무력화됩니다. Railway의 실제 프록시 토폴로지가 안 바뀌었다는 확인
  없이 이 값을 넓히는 건 절대 제안하지 않습니다.
- `AuthRateLimitGuard`와 `RateLimitGuard`는 같은 원자적 Lua 스크립트 패턴을 공유 유틸리티 하나로
  뽑아내지 않고 각자 따로 구현하고 있습니다 — 지금은 받아들일 만한 중복입니다(사용자별 vs IP별
  키잉이 달라서 추출이 간단하지 않음). 다만 같은 모양의 세 번째 호출부가 생기면 세 번째 복사본
  대신 공유 헬퍼로 뽑아내야 합니다.
- "일관성을 위해" `backend`에 Helmet의 CSP를 켜는 것은 절대 제안하지 않습니다 — 위 배경에서 설명한
  대로, 실제 렌더링 표면은 보호하지 못하면서 Swagger만 깨뜨리는 마찰을 추가할 뿐입니다.
