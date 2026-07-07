// Purpose: e2e coverage for the AI chat flow, including its retry/fallback path.
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable.
// Rationale: exercises the post-commit AiService.handleReply trigger end to end. A missing or
// invalid GEMINI_API_KEY still produces a deterministic fallback message (see
// AI_REPLY_FAILURE_MESSAGE in ai.service.ts), so this passes with or without a real Gemini key.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('sending a message to the AI chat gets a reply', async ({ page }) => {
    await registerAndSignIn(page, 'ai');

    await page.getByText('AI Chat', { exact: true }).click();

    // First-time AI chat requires picking a personality before any message is sent.
    await page.getByTestId('personality-option-friendly').click();

    const message = `hi AI ${Date.now()}`;
    await page.getByTestId('chat-message-input').fill(message);
    await page.getByTestId('chat-send-button').click();

    const messagesList = page.getByTestId('chat-messages-list');
    await expect(messagesList.getByText(message)).toBeVisible();

    // The AI's reply arrives via the same post-commit notifyRoomParticipants/subscription
    // path as a human message — either a real Gemini reply or, if the key is missing/invalid,
    // the fixed fallback notice. Either way a message from the AI's avatar shows up.
    await expect(messagesList.getByText('AI', { exact: true })).toBeVisible({
        timeout: 20_000,
    });
});
