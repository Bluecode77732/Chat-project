// 목적: 한 사용자가 보낸 메시지가 상대에게 실시간으로 전달되는지 검증하는 골든패스 e2e.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로 떠 있어야 함.
// 근거: sendMessage -> GqlTransactionInterceptor -> Redis pub/sub -> 구독으로 이어지는 경로를
// end-to-end로 검증함. 백엔드/프론트 단위 테스트는 이 경로를 전부 mock으로 대체함.

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

        // pageA의 유저 목록(GET_ALL_USERS, 60초 폴링)은 userB 생성 전에 조회된 상태 —
        // 새로고침으로 상대를 포함한 목록을 보게 함(실제 사용자가 상대 합류 후
        // 새로고침하는 것과 동일).
        await pageA.reload();
        await pageB.reload();
        await expect(pageA.getByTestId('chat-message-input')).toBeVisible();
        await expect(pageB.getByTestId('chat-message-input')).toBeVisible();

        // 양쪽 모두 닉네임으로 상대를 찾아 대화를 여는 방식 — CreateRoom 소켓 이벤트로
        // 미개설 대화 상태가 채워지길 기대하지 않고 실제 사용자 흐름을 따름.
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

        // 페이지 새로고침이 아니라 receiveMessage GraphQL 구독으로 전달됨
        await expect(pageB.getByText(message)).toBeVisible({ timeout: 10_000 });
    } finally {
        await contextA.close();
        await contextB.close();
    }
});
