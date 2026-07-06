// Purpose: shared test-data and auth flow helpers so golden-path specs don't duplicate register/sign-in steps.
// Usage: imported by frontend/e2e/*.spec.ts only.
// Rationale: register-then-sign-in is a prerequisite for every golden path, not a golden path in itself.

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
        // Nicknames must be unique and <=20 chars (RegisterDto @MaxLength(20)) — the label
        // is dropped here since the random suffix alone is already unique per test run.
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
    // register-page.tsx redirects to '/' 1.5s after success
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
