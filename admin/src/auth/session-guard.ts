// 목적: admin 앱에서 silent token refresh와 멀티탭 세션 충돌 감지의 단일 진입점
// (frontend/src/auth/session-guard.ts와 동일한 구조).
// 사용처: api/axios.ts(response interceptor), api/apollo.ts(errorLink),
// components/protected-route.tsx에서 import — 그 외에서는 /auth/token/refreshaccess를 직접 호출하지 않음.
// 근거: 기존에는 axios와 apollo가 각자 refresh 엔드포인트를 독립 호출해서 in-flight 공유도,
// 메인 frontend에 있는 cross-tab 계정 충돌 체크도 없었음.

import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/auth.store';

const SESSION_USER_KEY = 'admin:sessionUserId';

export const recordSessionUser = (userId: number) => {
    sessionStorage.setItem(SESSION_USER_KEY, String(userId));
};

export const clearSessionUser = () => {
    sessionStorage.removeItem(SESSION_USER_KEY);
};

// 탭의 첫 토큰 refresh는 그 시점에 공유 refreshToken 쿠키가 속한 계정을 그대로 채택.
// 이후 refresh는 반드시 그 계정과 일치해야 함 — 아니면 다른 admin으로 로그인한
// 형제 탭이 이 탭을 조용히 가로채게 됨.
const assertSessionUser = (userId: number): boolean => {
    const recorded = sessionStorage.getItem(SESSION_USER_KEY);
    if (recorded === null) {
        recordSessionUser(userId);
        return true;
    }
    return Number(recorded) === userId;
};

const rejectSession = () => {
    useAuthStore.getState().clearTokens();
    clearSessionUser();
    window.location.replace('/');
};

const doRefresh = async (): Promise<string | null> => {
    try {
        // refreshToken 쿠키는 credentials: 'include'로 자동 전송됨.
        // api/axios.ts의 axios 인스턴스 대신 fetch를 직접 사용 — axios.ts 자체가
        // refreshAccessTokenSafely()를 호출하므로 순환 import를 피하기 위함.
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/token/refreshaccess`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!res.ok) throw new Error('Refresh failed');

        const data = await res.json();
        const { sub, role } = jwtDecode<{ sub: number; role: number }>(data.accessToken);

        if (!assertSessionUser(sub)) {
            rejectSession();
            return null;
        }

        useAuthStore.getState().setTokens(data.accessToken, sub, role);
        return data.accessToken;
    } catch {
        rejectSession();
        return null;
    }
};

let pendingRefresh: Promise<string | null> | null = null;

// 동시 호출자(예: axios 401과 Apollo UNAUTHENTICATED 에러가 동시에 발생하는 경우)는
// 각자 refresh 엔드포인트를 호출하는 대신 하나의 in-flight 요청을 공유.
export const refreshAccessTokenSafely = (): Promise<string | null> => {
    if (!pendingRefresh) {
        pendingRefresh = doRefresh().finally(() => {
            pendingRefresh = null;
        });
    }
    return pendingRefresh;
};
