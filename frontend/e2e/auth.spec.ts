// Purpose: golden-path e2e for account creation and sign-in.
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable.
// Rationale: register-to-chat is the entry point for every other flow and had no test coverage.

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
