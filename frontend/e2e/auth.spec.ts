// 목적: 계정 생성 및 로그인 골든패스 e2e.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로 떠 있어야 함.
// 근거: 회원가입 후 채팅 진입은 다른 모든 흐름의 시작점인데 테스트 커버리지가 없었음.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('user can register and sign in to reach the chat page', async ({ page }) => {
    await registerAndSignIn(page, 'auth');
    await expect(page.getByTestId('chat-message-input')).toBeVisible();
});

test('sign-in shows an error for wrong credentials', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('signin-email-input').fill('nonexistent-e2e-user@test.local');
    await page.getByTestId('signin-password-input').fill('WrongPassword123');
    await page.getByTestId('signin-submit-button').click();
    await expect(page.getByText('Your email or password is not correct.')).toBeVisible();
});
