# 0022: NODE_ENV(표준)와 RUNTIME_ENV(native|docker) 분리

## 상태

Accepted

## 배경

`NODE_ENV`는 표준값 `development`/`production` 외에 비표준 세 번째 값 `'docker'`를 함께
가지고 있었습니다(`test`는 Jest의 기본 동작으로 암묵적으로 지원됐지만 docker-compose가 설정한
적은 없습니다). 이는 서로 무관한 세 질문을 변수 하나에 동시에 담고 있었던 것입니다:
`envFilePath` 선택(`app.module.ts:72-77`, 어떤 `.env*` 파일을 읽을지), HTTP 호스트 바인딩
(`main.ts:103-111`, `127.0.0.1` vs `0.0.0.0`), 그리고 Sentry `environment` 태그
(`instrument.ts:32`), Winston 로그 레벨(`logger.ts:18-20`, production이 아니면 `debug`),
에러 응답의 스택트레이스 노출(`all-exceptions.filter.ts:15`,
`isDev = NODE_ENV !== 'production'`)로 이어지는 배포 단계 신호.

루트의 `.env.local` 파일(docker-compose 스택의 시크릿 파일, gitignore됨) 역시 dotenv-flow
관례("어떤 환경에서든 우선 적용되는 gitignore된 로컬 오버라이드")를 벗어나 "docker-compose
전용 파일"이라는 의미로 재사용되고 있어, `envFilePath`의 3분기 로직과 충돌하고 표준 관례를
아는 사람에게는 혼동을 줄 수 있었습니다.

관례대로 표준값 하나를 그대로 골라 적용하면 각각 다른 문제가 생깁니다:
- docker-compose에 `NODE_ENV=development`를 쓰면("그냥 컨테이너화된 로컬 개발일 뿐") 기존
  `main.ts`의 `NODE_ENV === 'development' ? '127.0.0.1' : '0.0.0.0'` 로직 때문에 컨테이너
  리스너가 loopback에만 바인딩되어 매핑된 포트가 외부(컨테이너 네트워크 밖)에서 접근
  불가능해집니다.
- docker-compose에 `NODE_ENV=production`을 쓰면("Railway가 쓰는 것과 같은 프로덕션 타겟
  Dockerfile 빌드를 그대로 실행하니까") 로컬 docker-compose 테스트 에러가 Sentry에
  production으로 찍혀 실제 운영 장애와 구분이 안 되고, 로컬 디버깅 중에 로그 레벨과 스택트레이스
  노출까지 프로덕션 동작으로 바뀝니다.

`NODE_ENV=docker`는 우연히 두 문제 모두를 피하는 지점에 있었습니다. `main.ts`의 체크가
`'docker'`를 직접 비교하는 게 아니라 `=== 'development'`에 대한 암묵적 else였기 때문인데,
이는 설계된 보장이 아니라 우연이었고, 이를 확인하려면 `NODE_ENV`를 쓰는 모든 곳을 일일이
주의 깊게 읽어야 했습니다.

## 결정

- `NODE_ENV`는 프로젝트 전체에서 표준 3값(`development`, `test`, `production`)만 사용합니다.
  Sentry `environment` 태그(`instrument.ts:32`), Winston 로그 레벨(`logger.ts:18-20`), HTTP·
  GraphQL 에러 응답의 스택트레이스 노출(`all-exceptions.filter.ts:15`)을 그대로 결정하되,
  `'docker'` 리터럴 분기만 제거됩니다.
- 새 변수 `RUNTIME_ENV`(`native` | `docker`)는 "이 프로세스가 docker-compose 로컬 스택 안에서
  실행 중인가"만 답합니다. 값이 없으면 `native`로 간주하며, 이는 맨몸 `pnpm start:dev`/
  `start:prod`와 Railway 운영 환경 모두를 포함합니다(Railway는 이 값을 설정하지 않음).
- `envFilePath` 선택(`app.module.ts:72-77`)은 이제 `RUNTIME_ENV`를 먼저 봅니다:
  `RUNTIME_ENV === 'docker'` → `.env.docker`; 아니면 `NODE_ENV === 'production'` →
  `.env.production`; 아니면 → `.env`. "어떤 파일이냐"가 NODE_ENV의 기존 docker 편법에서
  분리됩니다.
- 호스트 바인딩(`main.ts:103-111`)은 `NODE_ENV === 'development' && RUNTIME_ENV !== 'docker'`
  일 때만 `127.0.0.1`로 제한합니다 — 즉 진짜 맨몸 로컬 개발일 때만. 그 외(로컬 도커, Railway
  운영)는 전부 `0.0.0.0`으로 바인딩합니다. `docker-compose.yml`이 이제 `NODE_ENV=development`를
  쓰기 때문에(다음 항목) 이 `RUNTIME_ENV` 체크가 없으면 컨테이너 포트가 loopback으로 잘못
  좁혀져 접근 불가능해집니다.
- `docker-compose.yml`의 `chat` 서비스는 `NODE_ENV: development` + `RUNTIME_ENV: docker`를
  설정하고(`docker-compose.yml:21-23`), `chat`/`postgres`/`redis` 세 서비스의 `env_file:` 모두
  `.env.local` 대신 `.env.docker`를 가리킵니다(`docker-compose.yml:16, 29, 55`).
  `NODE_ENV=development`를 쓰는 이유는(`production`이 아니라) 로컬 도커 실행이 로그/Sentry/
  에러노출 면에서 맨몸 로컬 개발과 동일하게 동작하도록 하기 위함이며, 위에서 설명한 Sentry
  오분류 문제를 피합니다. 이제 파일 선택과 호스트 바인딩 차이는 `RUNTIME_ENV=docker` 하나만이
  결정합니다.
- 루트의 `.env.local` 파일(docker-compose 시크릿 파일, gitignore됨)은 TypeORM CLI의 dotenv
  부트스트랩(`data-source.ts:8`)을 포함해 참조되는 모든 곳에서 `.env.docker`로 이름이 바뀝니다
  — 경로만 바뀌며, `override: false`를 쓰는 일반 `.env` 폴백 체인 구조는 그대로입니다.
- 고려했다가 배제한 대안:
  - **`NODE_ENV=docker`를 유지하고 `.env.local` → `.env.docker`로 이름만 변경**: 배제했습니다.
    `NODE_ENV`를 쓰는 모든 곳(Sentry 태그, 로그 레벨, 스택트레이스 노출)이 여전히 비표준
    네 번째 값을 특별 취급해야 하고, 배경에서 설명한 우연한 호스트 바인딩 안전성이 문서화되지
    않은 채 `main.ts`가 나중에 수정되면 깨지기 쉬운 상태로 남습니다.
  - **docker-compose에 `NODE_ENV=production`을 설정**: 배경에서 설명한 결정적 문제(로컬
    docker-compose 테스트 에러가 Sentry에 production 장애로 오분류) 때문에 배제했습니다.
  - **Railway가 주입하는 기존 변수의 부재로 "도커 여부"를 유추**(예:
    `RAILWAY_VOLUME_MOUNT_PATH`, [ADR 0018](0018-railway-volume-log-persistence.ko.md) 참고)
    — `RUNTIME_ENV`를 새로 추가하는 대신: 배제했습니다. "도커"를 "Railway가 아님"으로 정의하면
    "운영이 아님"과 뒤섞이고, 세 번째 배포 대상(Railway도 아니고 도커도 아닌)이 생기는 순간
    깨집니다. 명시적으로 값을 지정하는 변수가 더 명확하고, 다른 플랫폼의 환경변수가 계속
    안정적으로 유지된다는 가정에 기대지 않습니다.

## 결과

- 앞으로 "도커냐 맨몸 로컬 개발이냐"를 구분해야 하는 새 로컬 전용 동작이 생기면
  `docker-compose.yml`의 `chat` 서비스 `environment:` 블록에 `RUNTIME_ENV`를 추가해야
  합니다 — 이 목적으로 다시 `NODE_ENV`를 쓰지 않습니다.
- 이 변수 체계가 다시 바뀌면 `app.module.ts`의 `envFilePath`와 `main.ts`의 호스트 바인딩
  로직을 반드시 함께 갱신해야 합니다 — 둘 다 `RUNTIME_ENV`를 읽는 곳입니다.
- [ADR 0013](0013-local-dev-network-binding.ko.md)은 이 분리 이전에 작성되어 예전에는
  `NODE_ENV=docker`를 인용했습니다. 이제는 메커니즘을 다시 설명하는 대신 이 ADR을
  참조합니다.
- 이 저장소에서 `.env.local`은 더 이상 프로젝트 고유의 의미를 갖지 않습니다 — 다시 도입한다면
  dotenv-flow의 관례적 의미(로컬 오버라이드)로만 써야 하며, 배포 토폴로지 역할로 다시 재사용해서는
  안 됩니다.
