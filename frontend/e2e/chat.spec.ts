// Purpose: golden-path e2e verifying a message sent by one user is delivered live to the other.
// Usage: run via `pnpm e2e` in frontend/; requires backend on :3000 with Postgres/Redis reachable.
// Rationale: exercises sendMessage -> GqlTransactionInterceptor -> Redis pub/sub -> subscription
// end to end, which backend/frontend unit tests mock away entirely.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('a message sent by one user arrives live for the other', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
        const userA = await registerAndSignIn(pageA, 'chatA');
        const userB = await registerAndSignIn(pageB, 'chatB');

        // pageA's user list was fetched (GET_ALL_USERS, 60s poll) before userB existed —
        // reload so both sides see a banner that includes the other, as a real user would
        // after refreshing once their conversation partner has joined.
        await pageA.reload();
        await pageB.reload();
        await expect(pageA.getByTestId('chat-message-input')).toBeVisible();
        await expect(pageB.getByTestId('chat-message-input')).toBeVisible();

        // Each side finds the other by nickname and opens the conversation, mirroring
        // how a real user starts a chat rather than relying on the CreateRoom socket
        // event to populate state for an unopened conversation.
        await pageA.getByTestId('chat-user-search-input').fill(userB.nickname);
        const userBBadge = pageA.getByText(userB.nickname).first();
        await expect(userBBadge).toBeVisible({ timeout: 10_000 });
        await userBBadge.click();

        await pageB.getByTestId('chat-user-search-input').fill(userA.nickname);
        const userABadge = pageB.getByText(userA.nickname).first();
        await expect(userABadge).toBeVisible({ timeout: 10_000 });
        await userABadge.click();

        const message = `hello from A ${Date.now()}`;
        await pageA.getByTestId('chat-message-input').fill(message);
        await pageA.getByTestId('chat-send-button').click();

        // Delivered via the receiveMessage GraphQL subscription, not a page reload.
        await expect(pageB.getByText(message)).toBeVisible({ timeout: 10_000 });
    } finally {
        await contextA.close();
        await contextB.close();
    }
});
