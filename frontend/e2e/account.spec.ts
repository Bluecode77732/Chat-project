// 목적: 계정 페이지(프로필 수정, 계정 삭제) e2e 커버리지.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로 떠 있어야 함.
// 근거: account-page.tsx는 테스트 커버리지가 전혀 없었고, 삭제 플로우는 되돌릴 수 없음.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('user can update their nickname from the account page', async ({ page }) => {
    const user = await registerAndSignIn(page, 'acctupdate');

    await page.getByTestId('chat-account-button').click();
    await expect(page).toHaveURL('/account');

    // GET /user/:id가 폼을 채울 때까지 대기 후 수정함
    await expect(page.getByTestId('account-email-input')).toHaveValue(user.email);

    const newNickname = `updated${Date.now().toString(36)}`;
    await page.getByTestId('account-nickname-input').fill(newNickname);
    await page.getByTestId('account-save-button').click();

    await expect(page.getByText('변경사항이 저장되었습니다.')).toBeVisible();
});

test('user can delete their account and can no longer sign in', async ({ page }) => {
    const user = await registerAndSignIn(page, 'acctdelete');

    await page.getByTestId('chat-account-button').click();
    await expect(page).toHaveURL('/account');

    await page.getByTestId('account-delete-password-input').fill(user.password);
    await page.getByTestId('account-delete-request-button').click();
    await page.getByTestId('account-delete-confirm-button').click();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('signin-email-input')).toBeVisible();

    // 삭제된 계정 자격증명은 더 이상 동작하면 안 됨
    await page.getByTestId('signin-email-input').fill(user.email);
    await page.getByTestId('signin-password-input').fill(user.password);
    await page.getByTestId('signin-submit-button').click();
    await expect(page.getByText('Your email or password is not correct.')).toBeVisible();
});
