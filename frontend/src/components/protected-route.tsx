import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    // Token subscription from Zustand for auto rerendering when token change
    const accessToken = useAuthStore((state) => state.accessToken)

    if (!accessToken) {
        // Redirect to login page, prevents re-access to '/chat' when client going back with the browser
        return <Navigate to='/' replace />
    };

    return <>{children}</>;
}

export default ProtectedRoute;
