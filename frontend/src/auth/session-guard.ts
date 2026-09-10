import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/auth.store';

const SESSION_USER_KEY = 'chat:sessionUserId';

export const recordSessionUser = (userId: number) => {
    sessionStorage.setItem(SESSION_USER_KEY, String(userId));
};

export const clearSessionUser = () => {
    sessionStorage.removeItem(SESSION_USER_KEY);
};

// 탭의 첫 토큰 refresh는 그 시점에 공유 refreshToken 쿠키가 속한 계정을 그대로 채택.
// 이후 refresh는 반드시 그 계정과 일치해야 함 — 아니면 다른 계정으로 로그인한
// 형제 탭이 이 탭을 조용히 가로채게 됨.
const assertSessionUser = (userId: number): boolean => {
    const recorded = sessionStorage.getItem(SESSION_USER_KEY);
    if (recorded === null) {
        recordSessionUser(userId);
        return true;
    }
    return Number(recorded) === userId;
};

export const SESSION_CONFLICT_REASON = 'conflict';
export const SESSION_EXPIRED_REASON = 'expired';

type SessionRejectReason =
    | typeof SESSION_CONFLICT_REASON
    | typeof SESSION_EXPIRED_REASON;

const rejectSession = (reason?: SessionRejectReason) => {
    useAuthStore.getState().clearTokens();
    clearSessionUser();
    window.location.replace(reason ? `/?reason=${reason}` : '/');
};

// 서버 소켓이 강제 로그아웃을 push할 때 호출 (이 사용자가 다른 곳에서 방금 로그인함).
// refresh 시점 충돌과 동일한 종료 경로를 재사용.
export const rejectSessionConflict = () => rejectSession(SESSION_CONFLICT_REASON);

const doRefresh = async (): Promise<string | null> => {
    try {
        // refreshToken 쿠키는 credentials: 'include'로 자동 전송됨
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/token/refreshaccess`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!res.ok) {
            // 더 최근 로그인(예: 다른 브라우저)이 이 refresh token을 대체해서 백엔드가
            // 거부한 경우 — 단순 만료와 구분해서 사용자에게 "세션 만료" 대신
            // "다른 곳에서 로그인됨"을 보여줌.
            const body: { message?: string } = await res.json().catch(() => ({}));
            if (body.message === 'Session Superseded') {
                rejectSession(SESSION_CONFLICT_REASON);
                return null;
            }
            throw new Error('Refresh failed');
        }

        const data = await res.json();
        const { sub } = jwtDecode<{ sub: number }>(data.accessToken);

        if (!assertSessionUser(sub)) {
            rejectSession(SESSION_CONFLICT_REASON);
            return null;
        }

        useAuthStore.getState().setTokens(data.accessToken, sub);
        return data.accessToken;
    } catch {
        rejectSession(SESSION_EXPIRED_REASON);
        return null;
    }
};

let pendingRefresh: Promise<string | null> | null = null;

// 모든 silent(쿠키 기반) access token refresh의 단일 진입점.
// 새 access token으로 resolve되거나, refresh 실패 시 또는 쿠키가 이 탭이
// 마지막으로 인증했던 계정과 다른 계정에 속하게 됐을 때 null.
// 동시 호출자(예: React StrictMode의 이중 effect 호출, 또는 두 API 호출이
// 동시에 401을 받는 경우)는 하나의 in-flight 요청을 공유 — 그렇지 않으면
// 두 번째 호출자가 첫 호출의 불일치 감지와 `clearSessionUser()` 사이에
// 끼어들어, 기록된 baseline을 못 보고 이 탭이 새로 시작한 것처럼 충돌 중인
// 계정을 조용히 채택해버릴 수 있음.
export const refreshAccessTokenSafely = (): Promise<string | null> => {
    if (!pendingRefresh) {
        pendingRefresh = doRefresh().finally(() => {
            pendingRefresh = null;
        });
    }
    return pendingRefresh;
};
