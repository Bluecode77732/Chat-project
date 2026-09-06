// 목적: 단일 활성 세션 강제(두 번째 로그인 시 강제 로그아웃) e2e 커버리지.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로 떠 있어야 함.
// 근거: 두 번째 브라우저에서 로그인하면 첫 세션 소켓을 끊고 중립적인 '다른 곳에서 로그인됨'
// 안내를 띄워야 함 — 오래된 세션이 조용히 남아있으면 안 됨.

import { test, expect } from '@playwright/test';
import { registerAndSignIn, signIn } from './helpers';

test('signing in from a second browser force-logs-out the first', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
        const user = await registerAndSignIn(pageA, 'conflict');

        // 동일 계정으로 재로그인 — signIn만 호출해 같은 유저를 재사용함
        await signIn(pageB, user);

        // chat.service.ts의 kickPreviousSession이 A의 소켓에 'forceLogout'을 emit해
        // 중립적인 '다른 곳에서 로그인됨' 안내와 함께 로그인 화면으로 리다이렉트함.
        await expect(
            pageA.getByText('다른 곳에서 로그인되어 세션이 종료되었습니다. 다시 로그인해주세요.'),
        ).toBeVisible({ timeout: 10_000 });
    } finally {
        await contextA.close();
        await contextB.close();
    }
});
