// 목적: admin의 방 삭제 액션에 대한 e2e 커버리지.
// 사용처: admin/에서 `pnpm e2e`로 실행 — :3000 백엔드와 연결 가능한 Postgres/Redis,
// 시딩된 superadmin 계정 필요(e2e/.env.example 참고).
// 근거: rooms-page.tsx의 이 되돌릴 수 없는 액션에 커버리지가 전혀 없었음.

import { test, expect } from '@playwright/test';
import { loginAsSuperadmin, registerTargetUser, createRoomBetween } from './helpers';

test('Rooms table shows Created column and sort indicator switches between Room ID and Created', async ({ page, request }) => {
    const userA = await registerTargetUser(request, 'createdA');
    const userB = await registerTargetUser(request, 'createdB');
    const roomId = await createRoomBetween(request, userA, userB);

    await loginAsSuperadmin(page);
    await page.getByTestId('nav-rooms').click();
    await expect(page).toHaveURL('/rooms');

    const roomIdBtn = page.getByRole('columnheader').filter({ hasText: 'Room ID' }).getByRole('button');
    const createdBtn = page.getByRole('columnheader').filter({ hasText: 'Created' }).getByRole('button');

    // 기본값: Room ID가 bold임
    await expect(roomIdBtn).toHaveClass(/font-bold/);
    await expect(createdBtn).not.toHaveClass(/font-bold/);

    // Created 정렬로 전환
    await createdBtn.click();
    await expect(createdBtn).toHaveClass(/font-bold/);
    await expect(roomIdBtn).not.toHaveClass(/font-bold/);

    // 방 행의 Created 셀에 날짜 값이 들어있음
    const cells = page.getByTestId(`room-row-${roomId}`).locator('td');
    await expect(cells.nth(2)).toHaveText(/\d/);
});

test('superadmin can delete a room', async ({ page, request }) => {
    const userA = await registerTargetUser(request, 'roomA');
    const userB = await registerTargetUser(request, 'roomB');
    const roomId = await createRoomBetween(request, userA, userB);

    await loginAsSuperadmin(page);
    await page.getByTestId('nav-rooms').click();
    await expect(page).toHaveURL('/rooms');

    const row = page.getByTestId(`room-row-${roomId}`);
    await expect(row).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByTestId(`room-delete-${roomId}`).click();

    await expect(page.getByTestId('action-message')).toHaveText(`Room ${roomId} deleted.`);
    await expect(page.getByTestId(`room-row-${roomId}`)).toHaveCount(0);
});
