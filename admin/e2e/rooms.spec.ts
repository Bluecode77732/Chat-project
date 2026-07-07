// Purpose: e2e coverage for admin's room deletion action.
// Usage: run via `pnpm e2e` in admin/; requires backend on :3000 with Postgres/Redis
// reachable, and a seeded superadmin account (see e2e/.env.example).
// Rationale: rooms-page.tsx had zero coverage of this irreversible action.

import { test, expect } from '@playwright/test';
import { loginAsSuperadmin, registerTargetUser, createRoomBetween } from './helpers';

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
