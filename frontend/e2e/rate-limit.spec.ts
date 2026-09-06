// 목적: 유저별 RateLimitGuard(10건/15초) e2e 커버리지.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로 떠 있어야 함.
// 근거: 가드가 전송을 거부할 때 프론트가 RateLimitNotice를 띄우는지 검증함 —
// rate limit 에러가 조용히 사라지면 사용자에게는 보이지 않는 실패임.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('sending more than 10 messages within 15s shows the rate limit notice', async ({ page }) => {
    await registerAndSignIn(page, 'ratelimit');

    await page.getByText('AI Chat', { exact: true }).click();
    await page.getByTestId('personality-option-friendly').click();

    const input = page.getByTestId('chat-message-input');
    const sendButton = page.getByTestId('chat-send-button');

    // rate_limit:{userId}는 수신자와 무관하게 이 유저의 모든 sendMessage 호출이 공유하며
    // 15초 창 내 11번째 호출을 거부함. 각 전송은 완료까지 대기(mutation이 끝나야
    // input이 비워짐)시켜 11건이 React state 클로저끼리 경합하지 않고 순서대로
    // 개별 요청으로 처리되게 함.
    for (let i = 0; i < 10; i++) {
        await input.fill(`msg ${i} ${Date.now()}`);
        await sendButton.click();
        await expect(input).toHaveValue('');
    }

    await input.fill(`msg 10 ${Date.now()}`);
    await sendButton.click();

    await expect(page.getByTestId('rate-limit-notice')).toBeVisible({ timeout: 10_000 });
});
