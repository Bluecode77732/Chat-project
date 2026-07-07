// Purpose: e2e coverage for single-active-session enforcement (forced logout on second login).
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable.
// Rationale: signing in from a second browser must kick the first session's socket and show a
// neutral "logged in elsewhere" notice, not silently leave a stale session running.

import { test, expect } from '@playwright/test';
import { registerAndSignIn, signIn } from './helpers';

test('signing in from a second browser force-logs-out the first', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
        const user = await registerAndSignIn(pageA, 'conflict');

        // Second login as the same user from a different browser/session.
        await signIn(pageB, user);

        // chat.service.ts's kickPreviousSession emits 'forceLogout' to A's socket,
        // which redirects it to sign-in with a neutral "logged in elsewhere" notice.
        await expect(
            pageA.getByText('다른 곳에서 로그인되어 세션이 종료되었습니다. 다시 로그인해주세요.'),
        ).toBeVisible({ timeout: 10_000 });
    } finally {
        await contextA.close();
        await contextB.close();
    }
});
