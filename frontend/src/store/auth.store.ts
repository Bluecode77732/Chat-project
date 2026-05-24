import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    userId: number | null;
    lastRecipientId: number | null;
    setTokens: (accessToken: string, refreshToken: string, userId: number) => void;
    setLastRecipientId: (recipientId: number) => void;
    clearTokens: () => void;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            userId: null,
            lastRecipientId: null,
            setTokens: (accessToken, refreshToken, userId) =>
                set({ accessToken, refreshToken, userId }),
            setLastRecipientId: (recipientId) =>
                set({ lastRecipientId: recipientId }),
            clearTokens: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    userId: null,
                }),
        }),
        {
            name: 'auth',
            partialize: (state) => ({
                refreshToken: state.refreshToken,
                lastRecipientId: state.lastRecipientId,
            }),
        }
    )
)
