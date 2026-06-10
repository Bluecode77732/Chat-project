import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import api from "../api/axios";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { accessToken, setTokens, clearTokens } = useAuthStore();
    const [initializing, setInitializing] = useState(!accessToken);

    useEffect(() => {
        if (!accessToken) {
            // refreshToken cookie is sent automatically via withCredentials
            api.post('/auth/token/refreshaccess')
                .then(({ data }) => {
                    const { sub } = jwtDecode<{ sub: number }>(data.accessToken);
                    setTokens(data.accessToken, sub);
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
