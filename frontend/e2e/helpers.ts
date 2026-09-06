// 목적: 골든패스 스펙마다 회원가입/로그인 절차가 중복되지 않도록 테스트 데이터·인증 흐름 헬퍼를 모음.
// 사용처: frontend/e2e/*.spec.ts에서만 import.
// 근거: 회원가입 후 로그인은 모든 골든패스의 전제조건일 뿐 그 자체로 골든패스는 아님.

import { type Page, expect } from '@playwright/test';

export const TEST_PASSWORD = 'E2ETestPassword123';

interface TestUser {
    email: string;
    password: string;
    nickname: string;
}

function uniqueSuffix(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function makeTestUser(label: string): TestUser {
    const suffix = uniqueSuffix();
    return {
        email: `e2e-${label}-${suffix}@test.local`,
        // 닉네임은 유일해야 하고 20자 이하여야 함(RegisterDto @MaxLength(20)) — 랜덤 접미사만으로도
        // 테스트 실행마다 유일하므로 label은 붙이지 않음.
        nickname: `e2e${suffix}`,
        password: TEST_PASSWORD,
    };
}

export async function register(page: Page, user: TestUser): Promise<void> {
    await page.goto('/register');
    await page.getByTestId('register-email-input').fill(user.email);
    await page.getByTestId('register-password-input').fill(user.password);
    await page.getByTestId('register-confirm-password-input').fill(user.password);
    await page.getByTestId('register-nickname-input').fill(user.nickname);
    await page.getByTestId('register-submit-button').click();
    await expect(page.getByText('Registration Successful! Redirecting...')).toBeVisible();
    // register-page.tsx가 성공 1.5초 후 '/'로 리다이렉트함
    await expect(page).toHaveURL('/');
}

export async function signIn(page: Page, user: Pick<TestUser, 'email' | 'password'>): Promise<void> {
    await page.goto('/');
    await page.getByTestId('signin-email-input').fill(user.email);
    await page.getByTestId('signin-password-input').fill(user.password);
    await page.getByTestId('signin-submit-button').click();
    await expect(page).toHaveURL('/chat');
}

export async function registerAndSignIn(page: Page, label: string): Promise<TestUser> {
    const user = makeTestUser(label);
    await register(page, user);
    await signIn(page, user);
    return user;
}
