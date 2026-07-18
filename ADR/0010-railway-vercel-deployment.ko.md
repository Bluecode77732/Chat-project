# 0010: 배포는 Railway(backend) + Vercel(frontend, admin)

## 상태

Accepted

## 배경

세 개의 배포 단위(`backend`, `frontend`, `admin`)에 호스팅이 필요합니다: Postgres + Redis 연결을
유지하는 장기 실행 Node 프로세스 하나, 그리고 정적/SPA React 빌드 두 개.

## 결정

- `backend`는 Railway에 배포합니다: `railway.toml`이 `backend/Dockerfile`(멀티스테이지)을
  빌드하고, 시작 시 `pnpm migration:run && node dist/main`을 실행하며, 실패 시 최대 3회까지
  재시작합니다. `main` 브랜치로 push될 때 `.github/workflows/deploy.yml`의 `deploy` 잡이
  트리거합니다.
- Railway는 `healthcheckPath = "/health"`로 배포 헬스를 판단합니다(liveness만 확인 — DB/Redis는
  점검하지 않아, 일시적 의존성 장애가 정상 컨테이너의 재시작 루프로 이어지는 것을 방지합니다).
- `frontend`와 `admin`은 각각 자신만의 별도 Vercel 프로젝트에 배포되며, 각자 `vercel.json`(SPA
  리라이트만)을 가집니다.
- **이유:** 개인 프로젝트에 충분한 무료/저비용 티어, 그리고 두 플랫폼 모두에서 편리한
  GitHub-push-to-deploy 연동.

## 결과

- 플랫폼이 두 개로 나뉘어 있다는 것은 관측 가능성도 나뉜다는 뜻입니다 — 로그와 메트릭이 하나가
  아니라 서로 다른 두 대시보드에 존재하며, `backend`와 두 프론트엔드를 아우르는 통합 뷰는 없습니다. (Railway 쪽 로그 지속성은 별개로, 이 결정이 다루는 플랫폼 간 분리보다 좁은, 단일 플랫폼 내부의 문제입니다 — [ADR 0018](0018-railway-volume-log-persistence.ko.md)에서 따로 다룹니다.)
- `frontend`/`admin`을 (하나가 아니라) 두 개의 별도 Vercel 프로젝트로 운영하면 유지해야 할 CORS
  표면도 두 배가 됩니다(`CORS_ORIGIN`이 설정되는 모든 곳에 두 오리진을 모두 나열해야 합니다) — 두
  앱이 정말로 독립적인 배포 주기가 필요하고, admin/frontend 분리 자체가 의도적인 보안 경계 결정이었기
  때문에([0009](0009-admin-separate-app.ko.md) 참고) 받아들인 비용입니다.
- `backend`를 Vercel로 옮기는 것(서버리스 모델은 Postgres/Redis에 영구 연결을 유지하는 장기 실행
  Socket.IO 프로세스와 맞지 않습니다)이나, 명시적 요청 없이 `frontend`/`admin`을 Railway로 옮기는
  것은 절대 제안하지 않습니다 — 현재 구조는 각 배포 단위의 실제 런타임 형태에 맞춰져 있습니다.
