# 0018: Railway 볼륨을 붙여 재배포 후에도 로그를 보존

## 상태

Accepted

## 배경

`backend/src/base/logger/logger.ts`는 `winston.transports.File`로 winston 로그를 로컬
디렉터리에 기록합니다. 그런데 Railway의 컨테이너 파일시스템은 휘발성이라 재배포/재시작 때마다
지워집니다. 그래서 `AllExceptionsFilter`가 모든 5xx를
`level = Number(status) >= 500 ? 'error' : 'warn'` 로직으로 라우팅해 담는
`error.logs.log`(`backend/src/base/filter/all-exceptions.filter.ts:50`)는 사실상 쓰기
전용이었습니다. winston 설정과 필터 자체는 정상 동작했지만, 사후 장애 조사에는 쓸모가
없었습니다.

같은 파일에는 `const isVercel = process.env.VERCEL === '1'`로 `File` transport를 조건부로 끄는
분기도 있었는데, 실제 배포 환경에서는 죽은 코드임이 확인됐습니다. `VERCEL`은 저장소 어디에도
달리 등장하지 않고, `railway.toml`은 이 분기보다 약 3주 먼저 존재했으며,
[0010](0010-railway-vercel-deployment.ko.md)이 이미 backend를 Railway 전용으로 명시합니다.
Railway는 `process.env.VERCEL`을 설정하지 않으므로 운영 환경에서 `!isVercel`은 항상
`true`였습니다.

전체 메트릭/트레이싱/APM 도입은 이번 수정의 범위에서 명시적으로 제외했습니다. 목적은 좁게,
"기존 에러 로그가 재배포 후에도 남아 있게" 하는 것뿐입니다.

## 결정

- Railway 영구 볼륨을 backend 서비스에 연결합니다(대시보드, 또는 CLI의
  `railway volume add --mount-path /data`). Railway는 볼륨의 config-as-code 표현을 전혀
  제공하지 않습니다(`docs.railway.com/reference/config-as-code`,
  `docs.railway.com/volumes/reference`, `docs.railway.com/volumes`, `docs.railway.com/cli/volume`
  대조 확인). 따라서 볼륨 리소스는 저장소 밖에서 프로비저닝해야 하며, `railway.toml`은
  바뀌지 않습니다.
- `logger.ts`는 마운트 경로를 `RAILWAY_VOLUME_MOUNT_PATH`(볼륨이 연결되면 컨테이너 시작 시
  Railway가 자동 주입)에서 읽고, 값이 없으면(로컬 개발, CI, 볼륨이 연결되지 않은 Railway
  서비스) 기존의 `join(process.cwd(), 'logs')`로 폴백합니다. 그래서 Railway 밖에서의 동작은
  변하지 않습니다(`backend/src/base/logger/logger.ts:26-28`).
- 죽은 `isVercel` 분기는 제거했습니다. 두 `File` transport 모두 이제 조건 없이 생성되며,
  해석된 `logDir`을 가리킵니다(`backend/src/base/logger/logger.ts:50,61`).
- 고려했다가 배제한 대안:
  - **외부 로그 저장 서비스**(예: Better Stack): 배제했습니다. 새 npm 의존성, 새 외부 계정,
    로그 내용의 제3자 전송이 추가되는데, Railway 자체 인프라가 이미 같은 문제에 대한 1차적인
    지속성 수단을 제공합니다.
  - **기존 `MailModule`을 이용한 5xx 메일 알림**: 알림 문제만 풀 뿐 보존 문제는 풀지
    못합니다. 재배포 후 사고 이전의 로그 이력을 되돌아볼 수 없다는 원래의 목적을 충족하지
    못합니다.

## 결과

- Railway는 볼륨을 단일 non-replicated 인스턴스에 묶습니다. 이 backend가 나중에 여러 Railway
  레플리카로 확장된다면, 공유 볼륨 하나에 인스턴스별 로그 파일을 두는 방식은 재검토해야
  합니다. 지금은 backend가 단일 인스턴스로 돌고, 기존 수평 확장 대응책(Socket.IO Redis
  어댑터)도 파일 로깅과 무관하므로 막는 요소는 아닙니다.
- `RAILWAY_VOLUME_MOUNT_PATH`는 Joi로 검증되는 `ConfigService` 스키마(`backend/src/app.module.ts`)를
  거치지 않고 `process.env`에서 직접 읽습니다. winston 싱글턴은 Nest의 DI 컨테이너가 생기기
  전인 모듈 로드 시점에 만들어지므로, 이 파일이 원래 `LOG_LEVEL`/`NODE_ENV`를 `process.env`로
  직접 읽던 방식과 일관됩니다.
- 볼륨 프로비저닝은 이 저장소의 git 이력 밖에서 이루어지는 일회성 수동 단계(대시보드 또는
  CLI)입니다. 이 단계 없이 새로 clone/배포하면 요란하게 실패하는 대신 예전의 휘발성 동작으로
  조용히 되돌아갑니다. 이 backend용 Railway 환경을 새로 구성하는 사람은 볼륨 연결을 잊지
  말아야 합니다.
- 컨테이너 프로세스에 마운트 경로 쓰기 권한이 없으면 winston의 `File` transport는 예외를
  던지는 대신 `error` 이벤트를 발생시킵니다. 그래서 Console 출력은 정상인데 파일 로깅만
  조용히 멈출 수 있습니다. 첫 배포 후 한 번 확인할 가치는 있지만, 계속 신경 쓸 사안은
  아닙니다.
- **지속성 검증은 실제 배포 후에만 가능한 테스트이며, 아직 수행하지 않았습니다.** `pnpm lint`/
  `pnpm test`와 로컬 `pnpm start:dev` 스모크 테스트는 코드 로직(폴백 경로, 회귀 없음)만 확인할
  뿐, 이 ADR의 실제 주장 — 재배포해도 로그가 살아남는다 — 은 확인하지 못합니다. 그것은
  Railway의 실제 볼륨 마운트·컨테이너 재시작 동작에 달려 있고, 어떤 로컬 환경으로도 재현할 수
  없기 때문입니다. 볼륨 연결 후에만 가능한 남은 단계: 5xx를 하나 발생시켜 `error.logs.log`에
  기록되는지 확인 → 재배포 → 그 항목이 여전히 남아 있는지 확인.
