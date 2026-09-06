// 목적: 로그아웃이 세션을 지우고 보호된 라우트를 다시 잠그는지 검증하는 골든패스 e2e.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로 떠 있어야 함.
// 근거: signOut은 토큰 스토어, 소켓 연결, refreshToken 쿠키를 동시에 건드리는데
// 이들이 실제로 동기화되는지 end-to-end로 확인한 테스트가 없었음.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('user can sign out and is returned to the sign-in page', async ({ page }) => {
    await registerAndSignIn(page, 'signout');

    await page.getByTestId('chat-signout-button').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('signin-email-input')).toBeVisible();

    // 로그아웃 후 보호된 라우트는 접근 불가해야 함. refresh 쿠키도 서버에서 지워졌으므로
    // 단순 '/'가 아니라 session-guard의 만료 세션 경로(`/?reason=expired`)로 튕겨나감.
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page.getByTestId('signin-email-input')).toBeVisible();
});
