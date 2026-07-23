// Purpose: e2e coverage for the per-user RateLimitGuard (10 messages / 15s).
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable.
// Rationale: verifies the frontend surfaces RateLimitNotice when the guard rejects a send —
// a silently-dropped rate-limit error would be an invisible failure to the user.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('sending more than 10 messages within 15s shows the rate limit notice', async ({ page }) => {
    await registerAndSignIn(page, 'ratelimit');

    await page.getByText('AI Chat', { exact: true }).click();
    await page.getByTestId('personality-option-friendly').click();

    const input = page.getByTestId('chat-message-input');
    const sendButton = page.getByTestId('chat-send-button');

    // rate_limit:{userId} is shared across all of this user's sendMessage calls
    // regardless of recipient, and rejects the 11th call within the 15s window.
    // Each send is awaited to completion (input clears only after its mutation
    // resolves) so the 11 calls land as distinct, ordered requests rather than
    // racing each other through overlapping React state closures.
    for (let i = 0; i < 10; i++) {
        await input.fill(`msg ${i} ${Date.now()}`);
        await sendButton.click();
        await expect(input).toHaveValue('');
    }

    await input.fill(`msg 10 ${Date.now()}`);
    await sendButton.click();

    await expect(page.getByTestId('rate-limit-notice')).toBeVisible({ timeout: 10_000 });
});
