// 목적: 행동 모더레이션 e2e — 동일 메시지 반복 전송이 시스템 경고를 거쳐 일시 뮤트 안내까지
// 에스컬레이션되는지 검증.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로
// 떠 있고 MODERATION_* 기본 임계값(dup 3, warn 3, mute 5)이어야 함.
// 근거: 경고/뮤트가 조용히 적용되면 사용자에게는 보이지 않는 실패임 — 에스컬레이션이
// 채팅 화면(시스템 알림, 전송 차단 안내)까지 도달하는지 검증함.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('repeated identical messages escalate to a system warning then a mute notice', async ({ page }) => {
    await registerAndSignIn(page, 'moderation');

    // AI 채팅이 가장 단순한 전송 대상(상대 유저 불필요) — 모더레이션은 수신자와 무관하게
    // 발신 메시지에 적용됨. rate-limit.spec과 동일한 설정.
    await page.getByText('AI Chat', { exact: true }).click();
    await page.getByTestId('personality-option-friendly').click();

    const input = page.getByTestId('chat-message-input');
    const sendButton = page.getByTestId('chat-send-button');

    // 매번 동일 해시가 나오도록 고정 텍스트 사용. 중복 카운터는 3번째 동일 전송부터 strike가
    // 쌓여 10건/15초 rate limit 안에서 warn(3) -> mute(5)로 상승함(뮤트된 전송은 RateLimitGuard
    // 이전에 거부되므로 카운트되지 않음). strike 적립은 post-commit/비동기라 전송마다 약간의
    // 대기를 둠.
    const spam = 'please-stop-the-spam';
    const sendSpam = async () => {
        await input.fill(spam);
        await sendButton.click();
        await page.waitForTimeout(500);
    };

    for (let i = 0; i < 6; i++) await sendSpam();

    // strike 3 -> System 계정이 방에 경고를 게시함(중앙 정렬 안내)
    await expect(page.getByText(/반복적인 메시지가 감지/)).toBeVisible({ timeout: 15_000 });

    // 뮤트 임계값 초과 시 ModerationGuard가 전송을 거부하고 뮤트 안내를 띄움
    for (let i = 0; i < 3; i++) await sendSpam();
    await expect(page.getByText(/전송이 일시적으로 제한/)).toBeVisible({ timeout: 10_000 });
});
