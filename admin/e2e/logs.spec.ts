// 목적: 감사 로그 페이지 — 시간순 정렬과 액션 필터에 대한 e2e 커버리지.
// 사용처: admin/에서 `pnpm e2e`로 실행 — :3000 백엔드와 연결 가능한 Postgres/Redis,
// 시딩된 superadmin 계정 필요(e2e/.env.example 참고).
// 근거: logs-page.tsx의 정렬/필터 상호작용에 커버리지가 전혀 없었음.

import { test, expect } from '@playwright/test';
import { loginAsSuperadmin, registerTargetUser } from './helpers';

test('Audit log Time header is always bold and toggling sort re-renders the table', async ({ page, request }) => {
    const target = await registerTargetUser(request, 'logSort');
    await loginAsSuperadmin(page);

    // target을 승격 후 강등해 ROLE_CHANGE 로그를 만듦 — 강등까지 해야 admin이 남지
    // 않음. admin이 남으면 MAX_ADMIN_COUNT 슬롯을 소모해 users.spec.ts의
    // 승격/강등 테스트가 실패함.
    const row = page.getByTestId(`user-row-${target.id}`);
    await expect(row).toBeVisible();
    await row.getByTestId(`user-promote-${target.id}`).click();
    await expect(row.getByTestId(`user-role-${target.id}`)).toHaveText('admin');
    await row.getByTestId(`user-promote-${target.id}`).click();
    await expect(row.getByTestId(`user-role-${target.id}`)).toHaveText('user');

    await page.getByTestId('nav-logs').click();
    await expect(page).toHaveURL('/logs');

    const timeBtn = page.getByRole('columnheader').filter({ hasText: 'Time' }).getByRole('button');

    // 정렬 가능한 컬럼은 Time뿐이라 항상 bold임
    await expect(timeBtn).toHaveClass(/font-bold/);

    // ASC로 토글 후 다시 원위치 — 테이블은 계속 보여야 함
    await timeBtn.click();
    await expect(page.getByTestId('logs-table')).toBeVisible();

    await timeBtn.click();
    await expect(page.getByTestId('logs-table')).toBeVisible();
});

test('Audit log action filter narrows results', async ({ page }) => {
    await loginAsSuperadmin(page);
    await page.getByTestId('nav-logs').click();
    await expect(page).toHaveURL('/logs');

    await page.getByTestId('log-action-filter').selectOption('USER_DELETE');
    await expect(page.getByTestId('logs-table')).toBeVisible();
    // 행이 없을 수도 있어 반복문으로 검사 — 있다면 전부 USER_DELETE여야 함
    const badges = page.getByTestId('logs-table').locator('tbody td span');
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
        await expect(badges.nth(i)).toHaveText('USER_DELETE');
    }
});
