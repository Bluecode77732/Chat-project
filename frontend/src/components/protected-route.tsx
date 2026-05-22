import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import api from "../api/axios";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { accessToken, refreshToken, setTokens, clearTokens } = useAuthStore();
    const [initializing, setInitializing] = useState(!accessToken && !!refreshToken);

    useEffect(() => {
        if (!accessToken && refreshToken) {
            api.post('/auth/token/refreshaccess', null, {
                headers: { Authorization: `Bearer ${refreshToken}` },
            })
                .then(({ data }) => {
                    const { sub } = jwtDecode<{ sub: number }>(data.accessToken);
                    setTokens(data.accessToken, refreshToken, sub);
                })
                .catch(() => clearTokens())
                .finally(() => setInitializing(false));
        }
    }, []);

    if (initializing) return null;

    if (!accessToken) {
        return <Navigate to='/' replace />;
    }

    return <>{children}</>;
}

export default ProtectedRoute;
