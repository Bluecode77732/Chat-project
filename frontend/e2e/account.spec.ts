// Purpose: e2e coverage for the account page — profile updates and account deletion.
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable.
// Rationale: account-page.tsx had zero test coverage, including an irreversible delete flow.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('user can update their nickname from the account page', async ({ page }) => {
    const user = await registerAndSignIn(page, 'acctupdate');

    await page.getByTestId('chat-account-button').click();
    await expect(page).toHaveURL('/account');

    // Wait for GET /user/:id to populate the form before editing it.
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

    // The deleted account's credentials must no longer work.
    await page.getByTestId('signin-email-input').fill(user.email);
    await page.getByTestId('signin-password-input').fill(user.password);
    await page.getByTestId('signin-submit-button').click();
    await expect(page.getByText('Your email or password is not correct.')).toBeVisible();
});
