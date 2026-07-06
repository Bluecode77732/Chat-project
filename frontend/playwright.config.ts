// Purpose: configures Playwright to drive golden-path e2e flows against a real backend.
// Usage: run via `pnpm e2e` in frontend/; requires backend + Postgres + Redis already running.
// Rationale: frontend had no e2e coverage for auth/real-time flows that unit tests can't reach.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    // Tests share one live backend (rate limiting, single-active-session enforcement),
    // so running them concurrently would make them interfere with each other.
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
