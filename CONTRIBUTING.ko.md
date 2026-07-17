# 기여 가이드

이 저장소에 변경사항을 기여하기 위한 진입점입니다 — 설치, 브랜치 모델, 커밋 컨벤션, PR
체크리스트를 다룹니다. README의 빠른 시작은 앱을 로컬에서 실행하는 방법을 다루지만, 변경사항을
제출하는 워크플로우는 다루지 않습니다. CLAUDE.md는 이미 코드 수준의 깊은 컨벤션(Never Do 규칙,
테스트 패턴, 트랜잭션 경계)을 상세히 문서화하고 있습니다 — 이 문서는 그것을 다시 쓰지 않고, 새
기여자가 PR을 열 수 있는 지점까지 도달하게 하는 진입로 역할만 하며, 그 이후는 CLAUDE.md를
가리킵니다.

## 사전 준비물

- Node.js `24.x` (`.nvmrc`와 루트 `package.json`의 `engines`에 고정)
- pnpm `>=10` (루트 `package.json`에 `packageManager: pnpm@10.33.0`으로 고정 — CI도
  `pnpm/action-setup`으로 동일 버전을 설치)
- Docker + Docker Compose — 개별 서비스 실행 대신 로컬 풀스택(Postgres + Redis + backend)을 쓰고
  싶다면 필요

## 설치

```bash
pnpm install   # 워크스페이스 세 패키지(backend/, frontend/, admin/) 전부 설치
```

**backend**: `backend/.env.example`을 `backend/.env`로 복사하고 값을 채우세요 — 모든 변수는 시작 시
Joi로 검증되므로(`app.module.ts`), 하나라도 빠지면 조용히 넘어가지 않고 바로 실패합니다.

**frontend / admin**: 각 패키지의 `.env.example`을 `.env.local`로 복사하고, 백엔드가
`localhost:3000`이 아닌 다른 곳에서 돈다면 값을 조정하세요:
```bash
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
```

## 로컬 실행

**Docker로 풀스택 실행** (backend 작업에 권장 — 운영 환경의 마이그레이션 후 시작 순서와 동일):
```bash
docker compose up -d --build   # 프로젝트 루트에 .env.local이 필요합니다
docker compose down -v         # 종료
```

**Docker 없이 패키지별 실행**:
```bash
cd backend && pnpm start:dev   # NODE_ENV=development, 127.0.0.1:3000에 바인딩
cd frontend && pnpm dev        # Vite 개발 서버, :5173
cd admin && pnpm dev           # Vite 개발 서버, :5174
```

## 브랜치 모델

- `main` — 배포 브랜치입니다. `.github/workflows/deploy.yml`의 `deploy` job은 `main` push에서만
  트리거되어 Railway로 배포합니다.
- `dev` — 활성 개발 브랜치입니다.

(리모트에서 보일 수 있는 `dev1`이나 자동 생성되는 `railway/code-change-*` 같은 다른 브랜치는 여기
문서화된 워크플로우에 포함되지 않습니다 — 거기서 브랜치를 따려면 먼저 메인테이너에게 확인하세요.)

## 커밋 컨벤션

최근 히스토리는 `Prefix: description` 스타일을 씁니다 — 대문자로 시작하는 단어, 콜론, 짧은 설명
순서입니다. 앞으로는 다음 중 하나를 사용하세요:

`Fix:` `Feat:` `Add:` `Docs:` `Refactor:` `Test:` `Chore:` `Harden:` `Remove:` `Style:` `Logging:` `CI:`

참고: 이 컨벤션이 프로젝트 전체 히스토리에서 **일관되게** 지켜진 것은 아닙니다(오래된 커밋에서는
대소문자나 접두어 어휘가 꽤 제각각입니다) — `CHANGELOG.md`는 이를 미화하지 않고 있는 그대로
반영합니다. 새로 작성하는 커밋은 위 목록을 따라주세요.

## PR 제출 전

`.github/workflows/deploy.yml`은 `main`으로의 모든 PR에서 실행됩니다.

| Job | 하는 일 | 필수 통과? |
|---|---|---|
| `test` (ubuntu-latest) | `pnpm --filter backend lint`(비차단, `\|\| true`), `pnpm --filter backend test`, `pnpm --filter admin lint`(비차단), `pnpm --filter admin test` | 예 |
| `test` (windows-latest) | 동일 단계 | 아니오 — 이 OS는 매트릭스에서 `continue-on-error: true` |
| `e2e` | `frontend/` 대상 Playwright e2e, 실제 Postgres 16 + Redis 7 서비스 컨테이너 사용 | 예 — `deploy`의 `needs`에 포함되어 실패 시 배포를 막음 |
| `admin-e2e` | superadmin 시드 후 `admin/` 대상 Playwright e2e 실행 | 아니오 — `continue-on-error: true`; GitHub Actions에서 실제로 성공한 실행 이력이 아직 없어서 `deploy`의 `needs`에는 넣지 않았습니다(안정성이 확인되면 다시 blocking으로 전환) |

PR을 올리기 전 로컬에서:
```bash
cd backend
pnpm lint          # ESLint --fix
pnpm format        # Prettier
pnpm test          # Jest 유닛 테스트
pnpm test:e2e       # backend e2e (test/app.e2e-spec.ts)
```

코드 스타일은 `backend/.prettierrc`(`singleQuote: true`, `trailingComma: "all"`)와 ESLint
(`backend/eslint.config.mjs`)로 강제됩니다. 포맷팅 외에도 이 프로젝트는 더 엄격한 컨벤션 규칙(`any`
금지, floating promise 금지, 빈 `catch` 금지, `GqlTransactionInterceptor`를 통한 트랜잭션 경계 등)을
[CLAUDE.md](CLAUDE.md#never-do--forbidden-patterns)에 문서화해두었습니다 — backend 코드를 건드리기
전에, 특히 `app.module.ts`, `*.entity.ts`, `*.interceptor.ts`, `backend/src/schema.gql`처럼 CLAUDE.md의
Scope Discipline상 명시적 승인이 필요한 파일이라면 반드시 먼저 읽어보세요.

## 테스트 컨벤션

- 테스트는 소스 파일 옆에 `*.spec.ts`로 둡니다. 커버리지는 서비스와 Redis 모듈만 측정합니다
  (`backend/package.json`의 `coveragePathIgnorePatterns`가 controller, guard, gateway, resolver,
  interceptor, DTO, entity 등을 제외 — 의도된 정책이지 빈틈이 아닙니다).
- `bcrypt`는 `backend/src/mocks/bcrypt.ts`를 통해 전역으로 mock 처리됩니다.
- 실제 DB를 두드리지 말고 리포지토리를 mock하세요 — [CLAUDE.md의 Testing 절](CLAUDE.md#testing)에
  패턴이 있습니다.
- `frontend/e2e/`와 `admin/e2e/`는 각자의 Playwright 스위트를 가지며 CI에서 독립적으로 실행됩니다.

## 이슈 리포트

아직 이슈 템플릿이 설정되어 있지 않습니다 — 명확한 재현 방법/설명과 함께 GitHub 이슈를 열어주세요.
보안 관련 사안이라면 CLAUDE.md의 [Incident Response](CLAUDE.md#incident-response) 절에서 이
프로젝트의 AI 보조 워크플로우가 침해 의심 상황을 어떻게 다루는지 확인하세요.
