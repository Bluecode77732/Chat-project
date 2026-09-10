// 목적: AI 채팅 흐름(재시도/폴백 경로 포함) e2e 커버리지.
// 사용처: frontend/에서 `pnpm e2e`로 실행 — 백엔드가 :3000에서 Postgres/Redis에 연결된 채로 떠 있어야 함.
// 근거: post-commit AiService.handleReply 트리거를 end-to-end로 검증함. GEMINI_API_KEY가 없거나
// 잘못돼도 고정 폴백 메시지(ai.service.ts의 AI_REPLY_FAILURE_MESSAGE)가 나오므로
// 실제 Gemini 키 유무와 무관하게 통과함.

import { test, expect } from '@playwright/test';
import { registerAndSignIn } from './helpers';

test('sending a message to the AI chat gets a reply', async ({ page }) => {
    await registerAndSignIn(page, 'ai');

    await page.getByText('AI Chat', { exact: true }).click();

    // 첫 AI 채팅은 메시지 전송 전 성격 선택이 필수임
    await page.getByTestId('personality-option-friendly').click();

    const message = `hi AI ${Date.now()}`;
    await page.getByTestId('chat-message-input').fill(message);
    await page.getByTestId('chat-send-button').click();

    const messagesList = page.getByTestId('chat-messages-list');
    await expect(messagesList.getByText(message)).toBeVisible();

    // AI 답장도 사람 메시지와 동일한 post-commit notifyRoomParticipants/구독 경로로 옴 —
    // 실제 Gemini 응답이든 키 누락 시의 고정 폴백이든 AI 아바타 메시지는 반드시 나타남.
    await expect(messagesList.getByText('AI', { exact: true })).toBeVisible({
        timeout: 20_000,
    });
});

test('AI chat personality can be changed more than once', async ({ page }) => {
    await registerAndSignIn(page, 'personality');

    await page.getByText('AI Chat', { exact: true }).click();
    await page.getByTestId('personality-option-friendly').click();

    // 방과 성격 변경 버튼은 첫 메시지 이후에만 존재함
    await page.getByTestId('chat-message-input').fill(`hi ${Date.now()}`);
    await page.getByTestId('chat-send-button').click();
    await expect(page.getByText('성격 변경')).toBeVisible();

    // ai-room.service.ts의 getPersonalityInfo는 항상 canChange: true를 반환함(1회 제한 없음) —
    // 따라서 연속 변경도 '변경 불가' 안내 없이 둘 다 성공해야 함.
    await page.getByText('성격 변경').click();
    await page.getByTestId('personality-option-coding').click();
    await expect(page.getByText('지금은 성격을 변경할 수 없어요.')).not.toBeVisible();

    await page.getByText('성격 변경').click();
    await page.getByTestId('personality-option-english').click();
    await expect(page.getByText('지금은 성격을 변경할 수 없어요.')).not.toBeVisible();
});
