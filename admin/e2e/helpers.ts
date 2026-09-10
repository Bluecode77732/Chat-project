// 목적: admin e2e 스펙 전반에서 쓰는 로그인 및 테스트 픽스처 헬퍼.
// 사용처: admin/e2e/*.spec.ts 전용으로 import됨.
// 근거: superadmin 계정이나 대상 일반 유저를 만드는 인앱 플로우가 없어
// 테스트 대상 UI 밖에서 픽스처를 만들어야 함.

import { type APIRequestContext, type Page, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:3000';

export async function loginAsSuperadmin(page: Page): Promise<void> {
    const email = process.env.E2E_SUPERADMIN_EMAIL;
    const password = process.env.E2E_SUPERADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error(
            'E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD are not set — copy e2e/.env.example to e2e/.env and fill in a seeded superadmin account.',
        );
    }
    await page.goto('/');
    await page.getByTestId('login-email-input').fill(email);
    await page.getByTestId('login-password-input').fill(password);
    await page.getByTestId('login-submit-button').click();
    // 로그인 후 대시보드로 이동함(이 헬퍼 작성 이후 추가된 동작) — 기존 호출부는
    // 전부 /users 도착을 전제하므로 여기서 이어서 이동시킴.
    await expect(page).toHaveURL('/dashboard');
    await page.getByTestId('nav-users').click();
    await expect(page).toHaveURL('/users');
}

function uniqueSuffix(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function decodeUserId(accessToken: string): number {
    const payload = accessToken.split('.')[1];
    const json = Buffer.from(payload, 'base64url').toString('utf-8');
    return (JSON.parse(json) as { sub: number }).sub;
}

export interface TargetUser {
    id: number;
    email: string;
    password: string;
    nickname: string;
}

async function signInViaApi(
    request: APIRequestContext,
    email: string,
    password: string,
): Promise<string> {
    const credential = Buffer.from(`${email}:${password}`).toString('base64');
    const res = await request.post(`${BACKEND_URL}/auth/signin`, {
        headers: { Authorization: `Basic ${credential}` },
    });
    if (!res.ok()) {
        throw new Error(`Sign-in failed for ${email}: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { accessToken: string };
    return body.accessToken;
}

// admin에는 자체 회원가입 UI가 없고 이건 테스트 대상이 아닌 픽스처 설정이므로
// 백엔드 REST API로 직접 일반(user) 계정을 등록함.
export async function registerTargetUser(
    request: APIRequestContext,
    label: string,
): Promise<TargetUser> {
    const suffix = uniqueSuffix();
    const email = `admin-e2e-${label}-${suffix}@test.local`;
    const password = 'E2ETestPassword123';
    const nickname = `adm${suffix}`;

    const credential = Buffer.from(`${email}:${password}`).toString('base64');
    const registerRes = await request.post(`${BACKEND_URL}/auth/register`, {
        headers: { Authorization: `Basic ${credential}` },
        data: { nickname },
    });
    if (!registerRes.ok()) {
        throw new Error(
            `Failed to register fixture user ${email}: ${registerRes.status()} ${await registerRes.text()}`,
        );
    }

    const accessToken = await signInViaApi(request, email, password);
    return { id: decodeUserId(accessToken), email, password, nickname };
}

// 방을 만드는 인앱 플로우가 없어 sendMessage GraphQL mutation으로 `sender` 인증 하에
// 방 + 첫 메시지를 직접 만들어 rooms.spec.ts용 삭제 가능한 방을 시딩함.
export async function createRoomBetween(
    request: APIRequestContext,
    sender: TargetUser,
    recipient: TargetUser,
): Promise<number> {
    const token = await signInViaApi(request, sender.email, sender.password);
    const res = await request.post(`${BACKEND_URL}/graphql`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            query: `mutation SendMessage($input: CreateChatInput!, $recipientId: Int!) {
                sendMessage(input: $input, recipientId: $recipientId) { roomId }
            }`,
            variables: { input: { message: 'admin e2e seed message' }, recipientId: recipient.id },
        },
    });
    const body = (await res.json()) as {
        data?: { sendMessage: { roomId: number } };
        errors?: unknown;
    };
    if (body.errors || !body.data) {
        throw new Error(`Failed to seed room: ${JSON.stringify(body.errors)}`);
    }
    return body.data.sendMessage.roomId;
}
