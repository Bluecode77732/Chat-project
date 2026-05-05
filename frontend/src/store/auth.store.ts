// This file has Zustand store to keep JWT tokens.
// Every tokens must be read, injected, and controlled through Zustand.

import { create } from 'zustand';

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    setTokens: (accessToken: string, refreshToken: string) => void;
    clearTokens: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
    accessToken: null,
    refreshToken: null,
    setTokens: (accessToken, refreshToken) =>
        set({
            accessToken,
            refreshToken,
        }),
    clearTokens: () => set({
        accessToken: null,
        refreshToken: null,
    }),
}));
