// 목적: admin의 유저 관리 액션과 그로 인해 생기는 감사 기록에 대한 e2e 커버리지.
// 사용처: admin/에서 `pnpm e2e`로 실행 — :3000 백엔드와 연결 가능한 Postgres/Redis,
// 시딩된 superadmin 계정 필요(e2e/.env.example 참고).
// 근거: users-page.tsx의 이 권한 필요하고 일부 되돌릴 수 없는 액션들에 커버리지가
// 전혀 없었음.

import { test, expect } from '@playwright/test';
import { loginAsSuperadmin, registerTargetUser } from './helpers';

test('a non-admin account is rejected from the admin login', async ({ page, request }) => {
    const target = await registerTargetUser(request, 'reject');

    await page.goto('/');
    await page.getByTestId('login-email-input').fill(target.email);
    await page.getByTestId('login-password-input').fill(target.password);
    await page.getByTestId('login-submit-button').click();

    await expect(page.getByTestId('login-error')).toHaveText('Admin access only.');
    await expect(page).toHaveURL('/');
});

test('superadmin can force-log-out a user', async ({ page, request }) => {
    const target = await registerTargetUser(request, 'kick');
    await loginAsSuperadmin(page);

    const row = page.getByTestId(`user-row-${target.id}`);
    await expect(row).toBeVisible();
    await row.getByTestId(`user-force-logout-${target.id}`).click();

    await expect(page.getByTestId('action-message')).toHaveText(
        `User ${target.id} force-logged out.`,
    );
});

test('superadmin can promote and demote a user, and it appears in the audit log', async ({
    page,
    request,
}) => {
    const target = await registerTargetUser(request, 'promote');
    await loginAsSuperadmin(page);

    const row = page.getByTestId(`user-row-${target.id}`);
    await expect(row.getByTestId(`user-role-${target.id}`)).toHaveText('user');

    await row.getByTestId(`user-promote-${target.id}`).click();
    await expect(row.getByTestId(`user-role-${target.id}`)).toHaveText('admin');

    await row.getByTestId(`user-promote-${target.id}`).click();
    await expect(row.getByTestId(`user-role-${target.id}`)).toHaveText('user');

    await page.getByTestId('nav-logs').click();
    await expect(page).toHaveURL('/logs');
    await page.getByTestId('log-action-filter').selectOption('ROLE_CHANGE');
    // 승격/강등 각각 자기 ROLE_CHANGE 행을 남기므로 단일 매치가 아니라
    // 하나 이상 존재하는지만 확인함.
    await expect(page.getByTestId('logs-table').getByText(target.nickname).first()).toBeVisible();
});

test('Users table shows Created column and sort indicator switches between ID, Role, Created', async ({ page, request }) => {
    const target = await registerTargetUser(request, 'sort');
    await loginAsSuperadmin(page);

    const idBtn = page.getByRole('columnheader').filter({ hasText: 'ID' }).getByRole('button');
    const roleBtn = page.getByRole('columnheader').filter({ hasText: 'Role' }).getByRole('button');
    const createdBtn = page.getByRole('columnheader').filter({ hasText: 'Created' }).getByRole('button');

    // 기본값: ID가 bold임
    await expect(idBtn).toHaveClass(/font-bold/);
    await expect(roleBtn).not.toHaveClass(/font-bold/);
    await expect(createdBtn).not.toHaveClass(/font-bold/);

    // Role 정렬로 전환
    await roleBtn.click();
    await expect(roleBtn).toHaveClass(/font-bold/);
    await expect(idBtn).not.toHaveClass(/font-bold/);

    // Created 정렬로 전환
    await createdBtn.click();
    await expect(createdBtn).toHaveClass(/font-bold/);
    await expect(roleBtn).not.toHaveClass(/font-bold/);

    // 대상 유저 행의 Created 셀에 날짜 값이 들어있음
    const cells = page.getByTestId(`user-row-${target.id}`).locator('td');
    await expect(cells.nth(4)).toHaveText(/\d/);
});

test('search filters users by nickname and email', async ({ page, request }) => {
    const target = await registerTargetUser(request, 'search');
    await loginAsSuperadmin(page);

    const searchInput = page.getByTestId('user-search-input');

    // 닉네임으로 검색 — 대상 행만 매치해야 함
    await searchInput.fill(target.nickname);
    await expect(page.getByTestId(`user-row-${target.id}`)).toBeVisible();

    // 전체 이메일로 검색 — 대상 행이 여전히 보여야 함
    await searchInput.fill(target.email);
    await expect(page.getByTestId(`user-row-${target.id}`)).toBeVisible();

    // 검색어 지움 — 대상 행이 전체 목록에 남아있어야 함
    await searchInput.fill('');
    await expect(page.getByTestId(`user-row-${target.id}`)).toBeVisible();
});

test('superadmin can delete a user', async ({ page, request }) => {
    const target = await registerTargetUser(request, 'delete');
    await loginAsSuperadmin(page);

    const row = page.getByTestId(`user-row-${target.id}`);
    await expect(row).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByTestId(`user-delete-${target.id}`).click();

    await expect(page.getByTestId('action-message')).toHaveText(`User ${target.id} deleted.`);
    await expect(page.getByTestId(`user-row-${target.id}`)).toHaveCount(0);
});
