import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '../store/auth.store';

vi.mock('jwt-decode', () => ({
    jwtDecode: vi.fn(),
}));

import { jwtDecode } from 'jwt-decode';
import {
    refreshAccessTokenSafely,
    rejectSessionConflict,
    recordSessionUser,
    clearSessionUser,
} from './session-guard';

function mockFetchOnce(response: { ok: boolean; json: () => Promise<unknown> }) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('session-guard', () => {
    let replaceSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        useAuthStore.getState().clearTokens();
        clearSessionUser();
        // jsdom's Location object doesn't allow redefining individual own properties
        // (replace throws "Cannot redefine property" even with configurable: true) -- replace
        // window.location wholesale with a plain mock instead.
        replaceSpy = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...window.location, replace: replaceSpy },
        });
        (jwtDecode as ReturnType<typeof vi.fn>).mockReset();
    });

    afterEach(() => {
        useAuthStore.getState().clearTokens();
        clearSessionUser();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('stores the token and records the session user on a fresh (never-refreshed) tab.', async () => {
        (jwtDecode as ReturnType<typeof vi.fn>).mockReturnValue({ sub: 42 });
        mockFetchOnce({ ok: true, json: () => Promise.resolve({ accessToken: 'new-token' }) });

        const token = await refreshAccessTokenSafely();

        expect(token).toBe('new-token');
        expect(useAuthStore.getState().accessToken).toBe('new-token');
        expect(useAuthStore.getState().userId).toBe(42);
        expect(replaceSpy).not.toHaveBeenCalled();
    });

    it('rejects as a conflict when the refreshed token belongs to a different user than this tab recorded.', async () => {
        recordSessionUser(1);
        (jwtDecode as ReturnType<typeof vi.fn>).mockReturnValue({ sub: 2 });
        mockFetchOnce({ ok: true, json: () => Promise.resolve({ accessToken: 'other-users-token' }) });

        const token = await refreshAccessTokenSafely();

        expect(token).toBeNull();
        expect(useAuthStore.getState().accessToken).toBeNull();
        expect(replaceSpy).toHaveBeenCalledWith('/?reason=conflict');
    });

    it('rejects as a conflict on an explicit "Session Superseded" response, without decoding the token.', async () => {
        mockFetchOnce({ ok: false, json: () => Promise.resolve({ message: 'Session Superseded' }) });

        const token = await refreshAccessTokenSafely();

        expect(token).toBeNull();
        expect(jwtDecode).not.toHaveBeenCalled();
        expect(replaceSpy).toHaveBeenCalledWith('/?reason=conflict');
    });

    it('rejects as expired on a generic failed response.', async () => {
        mockFetchOnce({ ok: false, json: () => Promise.resolve({}) });

        const token = await refreshAccessTokenSafely();

        expect(token).toBeNull();
        expect(replaceSpy).toHaveBeenCalledWith('/?reason=expired');
    });

    it('rejects as expired when fetch itself throws (network error).', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

        const token = await refreshAccessTokenSafely();

        expect(token).toBeNull();
        expect(replaceSpy).toHaveBeenCalledWith('/?reason=expired');
    });

    it('shares one in-flight request across concurrent callers instead of firing fetch twice.', async () => {
        (jwtDecode as ReturnType<typeof vi.fn>).mockReturnValue({ sub: 7 });
        mockFetchOnce({ ok: true, json: () => Promise.resolve({ accessToken: 'shared-token' }) });

        const [first, second] = await Promise.all([
            refreshAccessTokenSafely(),
            refreshAccessTokenSafely(),
        ]);

        expect(first).toBe('shared-token');
        expect(second).toBe('shared-token');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('rejectSessionConflict() clears the session and redirects with the conflict reason directly.', () => {
        useAuthStore.getState().setTokens('token-abc', 1);
        recordSessionUser(1);

        rejectSessionConflict();

        expect(useAuthStore.getState().accessToken).toBeNull();
        expect(replaceSpy).toHaveBeenCalledWith('/?reason=conflict');
    });
});
