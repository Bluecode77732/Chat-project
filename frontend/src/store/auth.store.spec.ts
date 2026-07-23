import { describe, it, expect, afterEach } from 'vitest';
import { useAuthStore } from './auth.store';

describe('useAuthStore', () => {
    afterEach(() => {
        useAuthStore.getState().clearTokens();
    });

    it('starts with no token or userId.', () => {
        const state = useAuthStore.getState();

        expect(state.accessToken).toBeNull();
        expect(state.userId).toBeNull();
    });

    it('sets the token and userId together.', () => {
        useAuthStore.getState().setTokens('token-abc', 1);

        const state = useAuthStore.getState();
        expect(state.accessToken).toBe('token-abc');
        expect(state.userId).toBe(1);
    });

    it('clears the token and userId together.', () => {
        useAuthStore.getState().setTokens('token-abc', 1);
        useAuthStore.getState().clearTokens();

        const state = useAuthStore.getState();
        expect(state.accessToken).toBeNull();
        expect(state.userId).toBeNull();
    });

    it('does not clear lastRecipientId when tokens are cleared (only accessToken/userId reset).', () => {
        useAuthStore.getState().setLastRecipientId(42);
        useAuthStore.getState().setTokens('token-abc', 1);

        useAuthStore.getState().clearTokens();

        expect(useAuthStore.getState().lastRecipientId).toBe(42);
    });
});
