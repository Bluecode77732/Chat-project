// Purpose: golden-path e2e verifying sign-out clears the session and re-locks the protected route.
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable.
// Rationale: signOut touches the token store, socket connection, and refreshToken cookie together;
// no existing test confirms they actually stay in sync end to end.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('user can sign out and is returned to the sign-in page', async ({ page }) => {
    await registerAndSignIn(page, 'signout');

    await page.getByTestId('chat-signout-button').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('signin-email-input')).toBeVisible();

    // Protected route must not be reachable after sign-out. The refresh cookie was
    // cleared server-side too, so this bounces through session-guard's expired-session
    // path (`/?reason=expired`) rather than landing on a bare '/'.
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await expect(page.getByTestId('signin-email-input')).toBeVisible();
});
