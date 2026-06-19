import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/auth.store';

const SESSION_USER_KEY = 'chat:sessionUserId';

export const recordSessionUser = (userId: number) => {
    sessionStorage.setItem(SESSION_USER_KEY, String(userId));
};

export const clearSessionUser = () => {
    sessionStorage.removeItem(SESSION_USER_KEY);
};

// A tab's first token refresh adopts whichever account the shared refreshToken
// cookie currently belongs to. Any refresh after that must match, otherwise a
// sibling tab logging in as a different account would silently take this tab over.
const assertSessionUser = (userId: number): boolean => {
    const recorded = sessionStorage.getItem(SESSION_USER_KEY);
    if (recorded === null) {
        recordSessionUser(userId);
        return true;
    }
    return Number(recorded) === userId;
};

export const SESSION_CONFLICT_REASON = 'conflict';

const rejectSession = (reason?: typeof SESSION_CONFLICT_REASON) => {
    useAuthStore.getState().clearTokens();
    clearSessionUser();
    window.location.replace(reason ? `/?reason=${reason}` : '/');
};

const doRefresh = async (): Promise<string | null> => {
    try {
        // refreshToken cookie is sent automatically via credentials: 'include'
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/token/refreshaccess`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!res.ok) throw new Error('Refresh failed');

        const data = await res.json();
        const { sub } = jwtDecode<{ sub: number }>(data.accessToken);

        if (!assertSessionUser(sub)) {
            rejectSession(SESSION_CONFLICT_REASON);
            return null;
        }

        useAuthStore.getState().setTokens(data.accessToken, sub);
        return data.accessToken;
    } catch {
        rejectSession();
        return null;
    }
};

let pendingRefresh: Promise<string | null> | null = null;

// Single entry point for every silent (cookie-based) access token refresh.
// Resolves to the new access token, or null if the refresh failed or the
// cookie now belongs to a different account than this tab last authenticated as.
// Concurrent callers (e.g. React StrictMode's double effect invocation, or two
// API calls 401-ing at once) share one in-flight request — otherwise a second
// caller could land between the first call's mismatch detection and its
// `clearSessionUser()`, see no recorded baseline, and silently adopt the
// conflicting account as if this tab were brand new.
export const refreshAccessTokenSafely = (): Promise<string | null> => {
    if (!pendingRefresh) {
        pendingRefresh = doRefresh().finally(() => {
            pendingRefresh = null;
        });
    }
    return pendingRefresh;
};
