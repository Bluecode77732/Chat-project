> English version: [README.md](README.md)

# Frontend

실시간 채팅 앱의 React + TypeScript + Vite 클라이언트. 채팅 UI만 담당 — 관리자 대시보드는
[`admin/`](../admin)에 별도로 있음.

스택 세부사항, 아키텍처, 데이터 흐름은
[루트 README](../README.md#frontend)와 [ARCHITECTURE.md](../ARCHITECTURE.md) 참고.
환경 변수는 [`.env.example`](.env.example)에 인라인으로 문서화돼 있음.

## 개발 실행

env 템플릿을 복사하고 백엔드가 다른 곳에서 돈다면 값을 조정한 뒤 dev 서버 실행
(백엔드가 먼저 떠 있어야 함 — [루트 README Quick Start](../README.md#quick-start) 참고):

```powershell
cp .env.example .env.local
pnpm install
pnpm dev
```

→ http://localhost:5173

## 명령어

```powershell
pnpm dev      # Vite dev 서버 (5173 포트)
pnpm build    # 프로덕션 빌드
pnpm lint     # ESLint
pnpm test     # Vitest 단위 테스트
pnpm e2e      # Playwright e2e
```
