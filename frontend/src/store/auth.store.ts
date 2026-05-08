// This file has Zustand store to keep JWT tokens.
// Every tokens must be read, injected, and controlled through Zustand.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    userId: number | null
    setTokens: (accessToken: string, refreshToken: string, userId: number) => void;
    clearTokens: () => void;
};

export const useAuthStore = create<AuthState>()(
    // The 'Zustand' saves tokens in memory, which requires `persist()` to prevent vulnerability of refresh token when the page get refreshed.
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            userId: null,
            setTokens: (accessToken, refreshToken, userId) =>
                set({
                    accessToken,
                    refreshToken,
                    userId,
                }),
            clearTokens: () =>
                set({
                    accessToken: null,
                    refreshToken: null,
                    userId: null,
                }),
        }),
        {
            // An explicit key name for preventing name conflict.
            name: 'auth',
            // The `partialize` selects 'what' to save as data.
            // In this case, selected 'refreshToken' to be stored in 'localStorage', 
            // excludes 'accessToken' to prevent loss of token for a refreshed page,
            // so with 'refreshToken', the 'accessToken' can be issued immediately.
            partialize: (state) => ({ refreshToken: state.refreshToken }),
        }
    )
)

