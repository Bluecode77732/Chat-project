# 0020: 보안 헤더 분리(Helmet은 backend / CSP는 frontend+admin)와 IP 기반 인증 레이트리밋

## 상태

Accepted

## 배경

세 배포 단위는 렌더링 표면이 완전히 다릅니다. `backend`는 HTML을 거의 서빙하지
않고(REST/GraphQL은 JSON 전용, `/document`의 Swagger UI만 예외), 브라우저가 실제로 렌더링하는
페이지는 `frontend`/`admin` 쪽입니다. `ChatEntity.message`를 통한 저장형 XSS(CLAUDE.md의
[Render-Surface Sanitization](../CLAUDE.md#chat--caching) 참고)나 클릭재킹이 실제로 일어날 수
있는 지점도 거기입니다. 별개로, `POST /auth/signin`과 `POST /auth/register`는 아직 인증된
`userId`가 없어서 레이트리밋을 걸 기준이 없습니다. 기존 `RateLimitGuard`(사용자별,
[ADR 0016](0016-redis-unavailability-policy.ko.md))를 인증 전 단계에 그대로 재사용할 수는
없었지만, 이 두 엔드포인트에 대한 크리덴셜 스터핑/무차별 대입 공격에는 여전히 속도 제한이
필요했습니다.

## 결정

- **Helmet**(`helmet@^8.3.0`)을 `app.use(helmet({ contentSecurityPolicy: false }))`(`main.ts:37`)로
  백엔드 전역에 적용합니다. Helmet의 나머지 기본 보호(`X-Frame-Options`,
  `X-Content-Type-Options` 등)는 받으면서 Helmet 자체의 CSP 생성만 명시적으로 끕니다.
  `backend`에 CSP 헤더를 걸어봐야 보호 대상은 `/document`(Swagger)뿐인데, Swagger는 어차피
  인라인 스크립트에 광범위한 예외가 필요해 CSP의 의미가 퇴색되고, 실제 XSS 관련 표면(다른
  오리진)은 이 헤더로 애초에 보호할 수 없기 때문입니다.
- **CSP는 대신 `frontend`/`admin`에 적용**합니다. 백엔드 응답 헤더가 아니라 각 앱의 정적
  Vercel `headers` 설정(`frontend/vercel.json`, `admin/vercel.json`)을 쓰는데, 실제 렌더링이
  일어나는 곳이 거기이기 때문입니다. 두 정책은 서로 다릅니다. `frontend`에는
  `style-src 'self' 'unsafe-inline'`이 있고 `admin`에는 없습니다. 두 앱 모두 같은 스타일링
  스택(Tailwind, `package.json`으로 확인)을 쓰지만, React 인라인 `style={{...}}` prop을 쓰는
  곳은 `frontend/src/pages/chat-page.tsx` 하나뿐이고(이건 인라인 `style` 속성으로 렌더링되는데,
  CSP의 `style-src`는 `'unsafe-inline'`이나 nonce/hash 없이는 이를 막습니다), `admin`에는 그런
  사용처가 전혀 없습니다. 즉 admin 쪽 정책이 더 엄격한 것은 명시적으로 기록된 결정이 아니라
  결과적으로 그렇게 된 것입니다.
- `app.set('trust proxy', 1)`(`main.ts:29`)은 바로 앞 리버스 프록시(Railway) 딱 한 단계만
  신뢰합니다. 이 설정으로 `req.ip`가 Railway 프록시 자신의 주소 대신 실제 클라이언트 IP로
  해석되며, 이게 없으면 모든 클라이언트가 하나의 공유 레이트리밋 버킷으로 뭉개지므로 다음
  항목의 전제가 됩니다.
- `AuthRateLimitGuard`(`backend/src/auth/guard/auth-rate-limit.guard.ts`)는 `signin`/`register`를
  클라이언트 IP 기준으로(인증 전이라 `userId`를 쓸 수 없으므로) 레이트리밋합니다:
  `auth:{handler}-attempt:{ip}` 키로 60초 창에 10회. `RateLimitGuard`와 동일한 원자적
  `INCR`+조건부 `EXPIRE` Lua 패턴과 Redis 에러 시 fail-closed 처리를 그대로 재사용합니다. 가드
  하나를 위해 새 의존성(예: `@nestjs/throttler`)을 들이는 대신, 이미 확립된 자체 구현 패턴을
  재사용한 것입니다.
- 고려했다가 배제한 대안:
  - **`backend`에도 Helmet의 CSP 켜기**: 배제했습니다. `backend`가 서빙하는 유일한 HTML은
    `/document`의 Swagger UI인데, 여기엔 어차피 정책을 무력화할 만큼의 인라인 스크립트 예외가
    필요하고, 이 헤더는 실제 렌더링이 일어나는 `frontend`/`admin`(다른 오리진)에 닿지 않습니다.
  - **인증 레이트리밋에 `@nestjs/throttler` 사용**: 배제했습니다. 가드 하나를 위해 런타임
    의존성을 새로 들이는 셈인데, `RateLimitGuard`의 원자적 Lua `INCR`+`EXPIRE` 패턴(그리고
    Redis fail-closed 처리, [0016](0016-redis-unavailability-policy.ko.md) 참고)이 이미 있어
    그대로 재사용했습니다.
  - **`1` 대신 `trust proxy: true`**(전체 `X-Forwarded-For` 체인 신뢰): 배제했습니다.
    클라이언트가 위조한 `X-Forwarded-For` 헤더를 직접 넣어 요청마다 새 레이트리밋 버킷을 얻을
    수 있게 되어 `AuthRateLimitGuard`가 완전히 무력화됩니다.
  - **두 가드가 공유하는 레이트리밋 헬퍼 하나로 추출**: 진행하지 않았습니다. 사용자별/IP별
    키잉이 달라 지금은 깔끔하게 추출되지 않습니다. 세 번째 호출부가 생기면 다시
    검토합니다(결과 절에도 명시).

## 결과

- `frontend`/`admin`의 CSP 비대칭(`style-src 'unsafe-inline'`이 `frontend`에만 있음)은 명시적
  정책이 아니라, 어느 앱이 인라인 `style` prop을 쓰느냐의 부산물입니다. 나중에 `admin`에
  인라인 스타일을 쓰는 컴포넌트가 추가되면, 누군가 알아채고 `admin/vercel.json`을 고치기
  전까지 CSP가 조용히 그걸 막습니다. 반대로 `chat-page.tsx`의 인라인 스타일이 제거되면
  `frontend/vercel.json`도 `admin`의 더 엄격한 정책에 맞춰 조여야 합니다.
- `trust proxy`를 (`true`나 무제한이 아니라) `1`로 둔 것은 의도적입니다. 전체
  `X-Forwarded-For` 체인을 신뢰하면 클라이언트가 가짜 헤더 값으로 자기 IP를 위조할 수 있어
  `AuthRateLimitGuard`가 완전히 무력화됩니다. Railway의 실제 프록시 토폴로지가 바뀌지 않았다는
  확인 없이 이 값을 넓히는 것은 절대 제안하지 않습니다.
- `AuthRateLimitGuard`와 `RateLimitGuard`는 같은 원자적 Lua 스크립트 패턴을 공유 유틸리티로
  뽑지 않고 각자 구현하고 있습니다. 지금은 받아들일 만한 중복입니다(사용자별 vs IP별 키잉이
  달라 추출이 간단하지 않음). 다만 같은 모양의 세 번째 호출부가 생기면 세 번째 복사본 대신
  공유 헬퍼로 뽑아야 합니다.
- "일관성을 위해" `backend`에 Helmet의 CSP를 켜는 것은 절대 제안하지 않습니다. 위 배경에서
  설명했듯, 실제 렌더링 표면은 보호하지 못하면서 Swagger만 깨뜨리는 마찰을 더할 뿐입니다.
