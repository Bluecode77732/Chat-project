# 0018: Railway 볼륨을 붙여 재배포 후에도 로그를 보존

## 상태

Accepted

## 배경

`backend/src/base/logger/logger.ts`는 `winston.transports.File`을 통해 winston 로그를 로컬
디렉터리에 기록합니다. Railway의 컨테이너 파일시스템은 휘발성이라 재배포/재시작마다 지워지므로,
`AllExceptionsFilter`가 모든 5xx를 `level = Number(status) >= 500 ? 'error' : 'warn'` 로직으로
라우팅하는 `error.logs.log`(`backend/src/base/filter/all-exceptions.filter.ts:50`)는 사실상
쓰기 전용이었습니다 -- winston 설정과 필터 자체는 정상 동작했음에도 사후 장애 조사에는 쓸모가
없었습니다.

같은 파일에는 `const isVercel = process.env.VERCEL === '1'`로 `File` transport를 조건부로 끄는
분기도 있었습니다. 실제 배포 환경에서는 죽은 코드임이 확인되었습니다: `VERCEL`은 저장소 어디에도
달리 등장하지 않고, `railway.toml`은 이 분기보다 약 3주 먼저 존재했으며,
[0010](0010-railway-vercel-deployment.ko.md)이 이미 backend를 Railway 전용으로 명시합니다 --
Railway는 `process.env.VERCEL`을 절대 설정하지 않으므로, 운영 환경에서 `!isVercel`은 항상
`true`였습니다.

전체 메트릭/트레이싱/APM 도입은 이번 수정의 범위에서 명시적으로 제외했습니다 -- 좁게, "기존 에러
로그가 재배포 후에도 남아있게" 하는 것만이 목적입니다.

## 결정

- Railway 영구 볼륨을 backend 서비스에 연결합니다(대시보드, 또는 CLI의
  `railway volume add --mount-path /data`). Railway는 볼륨에 대한 config-as-code 표현 방식을
  전혀 제공하지 않습니다 -- `docs.railway.com/reference/config-as-code`,
  `docs.railway.com/volumes/reference`, `docs.railway.com/volumes`, `docs.railway.com/cli/volume`를
  대조하여 확인했습니다 -- 따라서 볼륨 리소스는 저장소 밖에서 프로비저닝해야 하며, `railway.toml`은
  변경되지 않습니다.
- `logger.ts`는 마운트 경로를 `RAILWAY_VOLUME_MOUNT_PATH`(볼륨이 연결되면 컨테이너 시작 시
  Railway가 자동 주입)에서 읽고, 값이 없으면(로컬 개발, CI, 또는 볼륨이 연결되지 않은 Railway
  서비스) 기존의 `join(process.cwd(), 'logs')`로 폴백합니다 -- 따라서 Railway 밖에서의 동작은
  변하지 않습니다(`backend/src/base/logger/logger.ts:26-28`).
- 죽은 `isVercel` 분기를 제거했습니다. 두 `File` transport 모두 이제 조건 없이 생성되며,
  해석된 `logDir`을 가리킵니다(`backend/src/base/logger/logger.ts:50,61`).
- 검토 후 기각한 대안:
  - **외부 로그 저장 서비스**(예: Better Stack): 새 npm 의존성, 새 외부 계정, 로그 내용의
    제3자 전송이 추가되는데 Railway 자체 인프라가 이미 동일한 문제에 대한 1차적인 지속성
    메커니즘을 제공하므로 기각했습니다.
  - **기존 `MailModule`을 이용한 5xx 메일 알림**: 이는 알림 문제만 해결할 뿐 보존 문제는
    해결하지 않습니다 -- 재배포 후 사고 이전의 로그 이력을 되돌아볼 수 없다는, 원래의 목적을
    충족하지 못합니다.

## 결과

- Railway는 볼륨을 단일 non-replicated 인스턴스에 묶습니다. 이 backend가 향후 여러 Railway
  레플리카로 스케일링된다면, 하나의 공유 볼륨에 인스턴스별 로그 파일을 두는 방식은 재검토가
  필요합니다 -- 지금은 backend가 단일 인스턴스로 동작하고 기존 수평 확장 대응책(Socket.IO Redis
  어댑터)이 파일 로깅과는 무관하므로 막는 요소는 아닙니다.
- `RAILWAY_VOLUME_MOUNT_PATH`는 Joi로 검증되는 `ConfigService` 스키마(`backend/src/app.module.ts`)를
  거치지 않고 `process.env`에서 직접 읽습니다 -- winston 싱글턴은 Nest의 DI 컨테이너가 존재하기
  전, 모듈 로드 시점에 생성되므로, 이 파일이 기존에 `LOG_LEVEL`/`NODE_ENV`를 직접 `process.env`로
  읽어온 방식과 일관됩니다.
- 볼륨 프로비저닝은 이 저장소의 git 이력 밖에서 이루어지는 일회성 수동 단계(대시보드 또는
  CLI)입니다 -- 이 단계 없이 새로 clone/배포하면 요란하게 실패하는 대신 예전의 휘발성 동작으로
  조용히 폴백됩니다. 이 backend용으로 새 Railway 환경을 구성하는 사람은 볼륨을 연결하는 것을
  잊지 않아야 합니다.
- 컨테이너 프로세스가 마운트된 경로에 쓰기 권한이 없다면, winston의 `File` transport는 예외를
  던지는 대신 `error` 이벤트를 발생시킵니다 -- Console 출력은 계속 정상 동작하면서 파일 로깅만
  조용히 멈출 수 있습니다. 첫 배포 후 한 번 확인할 가치는 있지만, 지속적으로 신경 쓸 사안은
  아닙니다.