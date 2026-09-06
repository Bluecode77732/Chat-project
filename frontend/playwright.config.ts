// 목적: 실제 백엔드를 대상으로 골든패스 e2e를 구동하도록 Playwright를 설정.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드+Postgres+Redis가 이미 떠 있어야 함.
// 근거: 단위 테스트가 닿지 못하는 인증/실시간 흐름에 대한 e2e 커버리지가 없었음.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    // 테스트들이 하나의 실제 백엔드를 공유함(rate limit, 단일 세션 강제) —
    // 동시 실행하면 서로 간섭함.
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'pnpm dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
