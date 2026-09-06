// 목적: 실제 백엔드를 대상으로 admin e2e 플로우를 구동하도록 Playwright를 설정.
// 사용처: admin/에서 `pnpm e2e`로 실행 — superadmin 계정을 만드는 인앱 플로우가
//        없으므로 백엔드와 시딩된 계정 필요(e2e/.env.example 참고).
// 근거: admin의 권한 필요한 유저/방/감사로그 액션에 커버리지가 전혀 없었음.

import { defineConfig, devices } from '@playwright/test';

try {
    process.loadEnvFile('./e2e/.env');
} catch {
    // e2e/.env는 git-ignore 대상이며 개발자가 직접 채워야 함 — 없으면 조용히
    // 건너뛰지 않고 "credentials missing" 에러로 명확히 실패하게 둠.
}

export default defineConfig({
    testDir: './e2e',
    // 테스트들이 하나의 라이브 백엔드와 시딩된 superadmin 세션 하나를 공유하므로
    // 동시 실행하면 서로 간섭함.
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:5174',
        trace: 'retain-on-failure',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'pnpm dev',
        url: 'http://localhost:5174',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
