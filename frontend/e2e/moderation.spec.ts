// Purpose: e2e coverage for behavioral moderation — repeated identical messages escalate to a
// visible system warning and then a temporary-mute notice.
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable
// and default MODERATION_* thresholds (dup 3, warn 3, mute 5).
// Rationale: a silently-applied warning/mute would be an invisible failure to the user — this
// verifies the escalation reaches the chat surface (system notice) and the send-blocked notice.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('repeated identical messages escalate to a system warning then a mute notice', async ({ page }) => {
    await registerAndSignIn(page, 'moderation');

    // AI chat is the simplest send target (no second user needed); moderation runs on the
    // sender's message regardless of recipient. Mirrors rate-limit.spec's setup.
    await page.getByText('AI Chat', { exact: true }).click();
    await page.getByTestId('personality-option-friendly').click();

    const input = page.getByTestId('chat-message-input');
    const sendButton = page.getByTestId('chat-send-button');

    // Fixed text so every send hashes identically. The duplicate counter accrues a strike from
    // the 3rd identical send onward, so strikes climb warn(3) -> mute(5) within the 10-msg/15s
    // rate limit (muted sends are rejected before RateLimitGuard, so they don't count). Strike
    // accrual is post-commit/async, so each send is paced slightly to let it settle.
    const spam = 'please-stop-the-spam';
    const sendSpam = async () => {
        await input.fill(spam);
        await sendButton.click();
        await page.waitForTimeout(500);
    };

    for (let i = 0; i < 6; i++) await sendSpam();

    // strike 3 -> the System account posts a warning into the room (centered notice).
    await expect(page.getByText(/반복적인 메시지가 감지/)).toBeVisible({ timeout: 15_000 });

    // Past the mute threshold a send is rejected by ModerationGuard and surfaces the mute notice.
    for (let i = 0; i < 3; i++) await sendSpam();
    await expect(page.getByText(/전송이 일시적으로 제한/)).toBeVisible({ timeout: 10_000 });
});
