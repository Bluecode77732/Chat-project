import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '../store/auth.store';

interface FakeRequestConfig {
    headers: Record<string, string>;
    _retry?: boolean;
}

interface FakeAxiosError {
    response?: { status: number };
    config: FakeRequestConfig;
}

const mockAxiosInstance = vi.hoisted(() => {
    const instance = Object.assign(vi.fn(), {
        interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
        },
        post: vi.fn(),
    });
    return instance;
});

vi.mock('axios', () => ({
    default: { create: vi.fn(() => mockAxiosInstance) },
}));

vi.mock('jwt-decode', () => ({
    jwtDecode: vi.fn(),
}));

import { jwtDecode } from 'jwt-decode';

await import('./axios');

const requestHandler = mockAxiosInstance.interceptors.request.use.mock.calls[0][0] as (
    config: FakeRequestConfig,
) => FakeRequestConfig;
const responseSuccessHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][0] as (
    response: unknown,
) => unknown;
const responseErrorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1] as (
    error: FakeAxiosError,
) => Promise<unknown>;

describe('admin axios instance', () => {
    let replaceSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockAxiosInstance.mockReset();
        mockAxiosInstance.post.mockReset();

        replaceSpy = vi.fn();
        vi.spyOn(window, 'location', 'get').mockReturnValue({
            ...window.location,
            replace: replaceSpy,
        } as Location);

        useAuthStore.getState().clearTokens();
    });

    afterEach(() => {
        useAuthStore.getState().clearTokens();
        vi.restoreAllMocks();
    });

    describe('request interceptor', () => {
        it('attaches the bearer token when one is stored and no Authorization header is set.', () => {
            useAuthStore.getState().setTokens('token-abc', 1, 1);

            const config = requestHandler({ headers: {} });

            expect(config.headers.Authorization).toBe('Bearer token-abc');
        });

        it('does not overwrite an existing Authorization header (e.g. Basic login).', () => {
            useAuthStore.getState().setTokens('token-abc', 1, 1);

            const config = requestHandler({ headers: { Authorization: 'Basic xyz' } });

            expect(config.headers.Authorization).toBe('Basic xyz');
        });
    });

    describe('response interceptor', () => {
        it('passes successful responses through unchanged.', () => {
            const response = { data: { ok: true } };

            expect(responseSuccessHandler(response)).toBe(response);
        });

        it('refreshes the token and retries the original request on a 401.', async () => {
            const original: FakeRequestConfig = { headers: {}, _retry: false };
            const error: FakeAxiosError = { response: { status: 401 }, config: original };

            mockAxiosInstance.post.mockResolvedValue({ data: { accessToken: 'new-token' } });
            (jwtDecode as ReturnType<typeof vi.fn>).mockReturnValue({ sub: 7, role: 1 });
            mockAxiosInstance.mockResolvedValue('retried-response');

            const result = await responseErrorHandler(error);

            expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/token/refreshaccess');
            expect(useAuthStore.getState().accessToken).toBe('new-token');
            expect(useAuthStore.getState().userId).toBe(7);
            expect(original.headers.Authorization).toBe('Bearer new-token');
            expect(original._retry).toBe(true);
            expect(mockAxiosInstance).toHaveBeenCalledWith(original);
            expect(result).toBe('retried-response');
        });

        it('clears tokens and redirects to the login page when the refresh itself fails.', async () => {
            const original: FakeRequestConfig = { headers: {}, _retry: false };
            const error: FakeAxiosError = { response: { status: 401 }, config: original };

            mockAxiosInstance.post.mockRejectedValue(new Error('refresh failed'));
            useAuthStore.getState().setTokens('stale-token', 1, 1);

            await expect(responseErrorHandler(error)).rejects.toBe(error);

            expect(useAuthStore.getState().accessToken).toBeNull();
            expect(replaceSpy).toHaveBeenCalledWith('/');
        });

        it('does not retry a request that already failed once.', async () => {
            const original: FakeRequestConfig = { headers: {}, _retry: true };
            const error: FakeAxiosError = { response: { status: 401 }, config: original };

            await expect(responseErrorHandler(error)).rejects.toBe(error);

            expect(mockAxiosInstance.post).not.toHaveBeenCalled();
        });

        it('passes through non-401 errors untouched.', async () => {
            const original: FakeRequestConfig = { headers: {}, _retry: false };
            const error: FakeAxiosError = { response: { status: 500 }, config: original };

            await expect(responseErrorHandler(error)).rejects.toBe(error);

            expect(mockAxiosInstance.post).not.toHaveBeenCalled();
        });
    });
});
