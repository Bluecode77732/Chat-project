# 0019: Sentry를 통한 backend 에러 트래킹 (5xx만)

## 상태

Accepted

## 배경

이번 세션의 관측 가능성 조사에서, 모노레포 전체에 메트릭·트레이싱·APM이 애플리케이션 레벨에서
전혀 없다는 것을 확인함. `backend/`, `frontend/`, `admin/` 어디에도
`prom-client`/`opentelemetry`/`Sentry` 계열 의존성이 없었음. `/health`는 liveness 전용이었고
상관관계 ID도 없었음. frontend/admin에는 에러 바운더리나 전역 JS 에러 핸들러가 전혀 없어서,
`frontend/src/pages/chat-page.tsx:410`의 처리 안 된 에러는 어디에도 흔적 없이
사라짐. [ADR 0018](0018-railway-volume-log-persistence.ko.md)이 로그의 *지속성*은
해결했지만, Railway 볼륨에 남는 `error.logs.log`도 검색·그룹핑·알림 기능은 없어서 누군가
일부러 찾아봐야만 의미가 있음.

범위는 의도적으로 좁힘. **에러 트래킹만**(메트릭·분산 트레이싱/성능 모니터링 제외),
**backend만**(frontend/admin은 별도 후속 작업으로 명시적으로 미룸), **무료/저비용 티어
우선** — [ADR 0010](0010-railway-vercel-deployment.ko.md)에 이미 명시된 이 프로젝트의 운영
철학과 일관됨.

## 결정

- 도구: **Sentry**, 공식 `@sentry/nestjs` 패키지 사용(MIT 라이선스, npm에서 확인; peer 범위
  `@nestjs/common ^8‖9‖10‖11.0.0`이 이 저장소의 NestJS 11을 커버). 무료 "Developer" 플랜: 월
  5,000 에러 이벤트, 사용자 1명, 30일 보관.
- `backend/src/instrument.ts`(신규 파일)가 `Sentry.init()`을 호출하며,
  `if (process.env.SENTRY_DSN)`(`instrument.ts:29`)로 가드됨. 값이 없으면 `Sentry.init()`
  자체가 실행되지 않고 모든 `captureException` 호출이 안전한 no-op이 됨. 설치된 SDK의
  실제 소스인 `@sentry/core`의 `Scope.captureException`을 직접 확인한 결과, client가 구성되지
  않으면 예외를 던지거나 네트워크 I/O를 시도하지 않고 조기 반환함. `MailModule`
  (`backend/src/mail/mail.service.ts:12-24`)과 같은 선택적 통합 구조임.
  - `environment: process.env.NODE_ENV`이며 `ENV`가 아님(`instrument.ts:32`). `ENV`는 Joi
    스키마에서 `.required()`지만 `backend/src` 어디에도 실제 소비자가 없고, dev/prod 동작을
    실제로 좌우하는 것은 `NODE_ENV`임(`logger.ts:20`, `all-exceptions.filter.ts:15`,
    `main.ts`).
  - `sendDefaultPii`는 절대 설정하지 않음(`instrument.ts`). 실제로 존재했고 이미 패치된
    CVE(GHSA-6465-jgvq-jhgp, SDK 10.11.0-10.26.0)가 이 플래그를 통해 `Authorization`/`Cookie`
    헤더를 유출시킨 전례가 있음. `@sentry/nestjs`는 수정된 최저 버전(`10.27.0`)보다 훨씬
    높은 `^10.66.0`으로 고정함.
  - `tracesSampleRate: 0`(`instrument.ts:34`) — 성능 모니터링은 범위 밖임.
  - `beforeSend` 훅(`instrument.ts:35-51`)이 요청 데이터·extra 컨텍스트·breadcrumb에서
    `password`/`token`/`secret` 이름이 붙은 필드를 재귀적으로 지운 뒤에야 이벤트를 프로세스
    밖으로 내보냄. Sentry 자체의 헤더/쿠키 차단 목록은 임의의 본문 필드까지 커버하지
    않음. 그래서 추가한 심층 방어이며, 이 저장소의 기존 "민감 필드는 절대 로그에 남기지
    않는다" 규칙을 이 새로운 외부 전송 경로에도 똑같이 적용한 것임. Sentry는 제3자
    SaaS라서, ADR 0018 덕에 Railway 볼륨에 남는 winston 로그와는 성격이 다름.
  - `backend/src/main.ts:1`이 `./instrument`를 `NestFactory`보다 먼저, 파일 맨 첫 줄에서
    import함. Sentry 문서상 이 순서는 필수임. 자동 계측이 패치하는 모듈들이
    `Sentry.init()` 실행 시점에 아직 로드되지 않은 상태여야 하기 때문임.
- `backend/src/app.module.ts:73`이 `imports`에 `SentryModule.forRoot()`를
  추가하고(`@sentry/nestjs/setup`에서 가져옴), `:62`가 Joi 스키마에
  `SENTRY_DSN: Joi.string().optional()`을 추가함. 같은 스키마에 이미 있던 `SMTP_HOST`
  선례를 그대로 따른 것임.
- `backend/src/base/filter/all-exceptions.filter.ts:56-58`이 수동
  `Sentry.captureException(exception, { extra: { stack, isGraphQL } })` 호출 하나를 추가하며,
  `Number(status) >= 500` 조건으로 가드됨. 필터가 `:51`에서 `logger[level]`을 위해 이미
  계산해둔 것과 같은 조건임.
- **Sentry 자체의 `@SentryExceptionCaptured()` 데코레이터는 채택하지 않음.** Sentry의
  NestJS 문서는 기존 전역 catch-all 필터가 있는 앱에 (`SentryGlobalFilter`로 교체하는 대신)
  이 데코레이터를 권장함. 하지만 기본 동작은 `HttpException` 인스턴스를 캡처하지 않음.
  Sentry 자체 GitHub 이슈 트래커(`getsentry/sentry-javascript#14580`, `#13064`)로 확인함.
  이는 이 코드베이스의 실제 경로 두 곳을 깨뜨림:
  1. **실제 500 누락**: `InternalServerErrorException`(`HttpException`의 서브클래스)이
     `backend/src/chat/interceptor/gql-transaction.interceptor.ts:74`(롤백된 채팅 트랜잭션)와
     `backend/src/chat/decorator/gql-query-runner.decorator.ts:21`에서 던져짐. 데코레이터의
     기본 동작으로는 둘 다 Sentry에 절대 도달하지 못함.
  2. **의도된 4xx 과다 보고**: `all-exceptions.filter.ts`의 `isPayloadTooLarge` 분기는
     (`HttpException`이 아닌) 원시 body-parser 에러를 무해한 413으로 매핑함. 데코레이터의
     기본 동작은 이걸 여전히 예상 밖 에러로 취급해서, 평범한 용량 초과 업로드에도 쿼터를
     소모시킴.
  필터가 이미 계산해둔 상태 체크로 가드한 수동 캡처는 이 두 실패 모드를 모두 피함. "이게
  나쁜 상황인지"를 판단하는 두 번째 기준을 새로 만들지 않고, 기존 로직을 재사용함.
- 고려했다가 배제한 대안: 자체 호스팅 또는 매니지드 메트릭/트레이싱 스택(Prometheus/Grafana,
  OpenTelemetry + 컬렉터). ADR 0010에 명시된 1인 개발·무료 티어 우선 프로젝트 규모에는
  과함. 이 에러 트래킹 결정과 달리 범위를 좁힌 게 아니라 통째로 보류함.

## 결과

- 무료 티어의 월 5,000 이벤트는 확실한 상한선임. 평상시 트래픽에서는 거의 도달하지
  않음(4xx가 아니라 진짜 5xx만 집계). 다만 아무도 못 알아챈 반복적인 5xx 장애라면 몇 시간
  안에 다 소모될 수 있음. 그 청구 주기의 이후 이벤트는 조용히 사라짐 — 과금도, 앱
  크래시도 없이 한도 이후로는 그냥 안 보일 뿐임.
- `SENTRY_DSN`은 소비 시점(`instrument.ts`)에 Joi로 검증되는 `ConfigService`
  (`backend/src/app.module.ts`)를 거치지 않고 `process.env`에서 직접 읽음. SDK가 Nest의
  DI 컨테이너가 생기기 전에 초기화되어야 하기 때문이며, ADR 0018이 `RAILWAY_VOLUME_MOUNT_PATH`에
  대해 세운 것과 같은 근거임.
- DSN 확보는 일회성 수동 단계임(Sentry 계정 + 프로젝트, 이 저장소 밖의 일). ADR 0018의
  Railway 볼륨과 같은 "이건 사람이 할 일" 틀임. 로컬 개발/CI에는 아무것도 필요 없고, DSN
  없이도 통합은 그냥 no-op이 됨.
- **frontend/admin은 여전히 에러 가시성이 전혀 없음.** 그쪽의 처리 안 된 JS 에러는 오늘도
  그대로 사라짐. 실수로 빠뜨린 게 아니라, 명시적인 범위 결정으로 별도 후속 작업으로 미뤄둔
  것임.
- 메트릭과 분산 트레이싱은 여전히 완전히 부재하며, 이 ADR은 그 상태를 바꾸지 않음. 이 둘에
  대한 현재 정책은 CLAUDE.md의 Observability 권고 항목을 참고하세요.
