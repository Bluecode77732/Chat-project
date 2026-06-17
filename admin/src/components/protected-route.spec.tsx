import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import ProtectedRoute from './protected-route';

vi.mock('../api/axios', () => ({
    default: { post: vi.fn() },
}));

vi.mock('jwt-decode', () => ({
    jwtDecode: vi.fn(),
}));

import api from '../api/axios';
import { jwtDecode } from 'jwt-decode';

function renderProtectedRoute() {
    return render(
        <MemoryRouter initialEntries={['/protected']}>
            <Routes>
                <Route path='/' element={<div>Login Page</div>} />
                <Route
                    path='/protected'
                    element={
                        <ProtectedRoute>
                            <div>Secret Content</div>
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </MemoryRouter>,
    );
}

describe('ProtectedRoute', () => {
    beforeEach(() => {
        useAuthStore.getState().clearTokens();
        vi.clearAllMocks();
    });

    afterEach(() => {
        useAuthStore.getState().clearTokens();
    });

    it('renders the protected content when an admin token is already present.', async () => {
        useAuthStore.getState().setTokens('token-abc', 1, 1);

        renderProtectedRoute();

        expect(await screen.findByText('Secret Content')).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });

    it('redirects a regular user (role 0) away from the protected content.', async () => {
        useAuthStore.getState().setTokens('token-abc', 1, 0);

        renderProtectedRoute();

        expect(await screen.findByText('Login Page')).toBeInTheDocument();
        expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
    });

    it('refreshes the token on mount when none is stored, then renders for an admin.', async () => {
        (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
            data: { accessToken: 'new-token' },
        });
        (jwtDecode as ReturnType<typeof vi.fn>).mockReturnValue({ sub: 5, role: 1 });

        renderProtectedRoute();

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/token/refreshaccess'));
        expect(await screen.findByText('Secret Content')).toBeInTheDocument();
        expect(useAuthStore.getState().accessToken).toBe('new-token');
    });

    it('redirects to the login page when the silent refresh fails.', async () => {
        (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no refresh token'));

        renderProtectedRoute();

        expect(await screen.findByText('Login Page')).toBeInTheDocument();
        expect(useAuthStore.getState().accessToken).toBeNull();
    });
});
