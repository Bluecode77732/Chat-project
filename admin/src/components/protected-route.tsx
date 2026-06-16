import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { accessToken, role, setTokens, clearTokens } = useAuthStore();
    const [initializing, setInitializing] = useState(!accessToken);

    useEffect(() => {
        if (!accessToken) {
            api.post('/auth/token/refreshaccess')
                .then(({ data }) => {
                    const { sub, role: decodedRole } = jwtDecode<{ sub: number; role: number }>(data.accessToken);
                    setTokens(data.accessToken, sub, decodedRole);
                })
                .catch(() => clearTokens())
                .finally(() => setInitializing(false));
        }
    }, []);

    if (initializing) return null;

    if (!accessToken || role !== 1) {
        return <Navigate to='/' replace />;
    }

    return <>{children}</>;
}

export default ProtectedRoute;
