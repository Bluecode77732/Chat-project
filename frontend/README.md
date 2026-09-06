> 한국어 버전: [README.ko.md](README.ko.md)

# Frontend

React + TypeScript + Vite client for the real-time chat app. Chat UI only — the admin
dashboard lives in [`admin/`](../admin).

For stack details, architecture, and data flow, see the
[root README](../README.md#frontend) and [ARCHITECTURE.md](../ARCHITECTURE.md).
Env vars are documented inline in [`.env.example`](.env.example).

## Dev

Copy the env template and adjust if the backend runs elsewhere, then start the dev server
(backend must already be running — see the [root README Quick Start](../README.md#quick-start)):

```powershell
cp .env.example .env.local
pnpm install
pnpm dev
```

→ http://localhost:5173

## Commands

```powershell
pnpm dev      # Vite dev server (port 5173)
pnpm build    # Production build
pnpm lint     # ESLint
pnpm test     # Vitest unit tests
pnpm e2e      # Playwright e2e
```
