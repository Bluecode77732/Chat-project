import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    accessToken: string | null;
    userId: number | null;
    lastRecipientId: number | null;
    setTokens: (accessToken: string, userId: number) => void;
    setLastRecipientId: (recipientId: number) => void;
    clearTokens: () => void;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            userId: null,
            lastRecipientId: null,
            setTokens: (accessToken, userId) =>
                set({ accessToken, userId }),
            setLastRecipientId: (recipientId) =>
                set({ lastRecipientId: recipientId }),
            clearTokens: () =>
                set({
                    accessToken: null,
                    userId: null,
                }),
        }),
        {
            name: 'auth',
            partialize: (state) => ({
                lastRecipientId: state.lastRecipientId,
            }),
        }
    )
)
