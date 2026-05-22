import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/auth.store';

// Creating Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
});


// Automatic 'accessToken' renewal on 401=Forbidden error.
// `interceptors.request.use` intercepts all requests to inject 'accessToken' on each requests automatically.
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        // JWTAuthGuard verifies Bearer token via this header.
        config.headers.Authorization = `Bearer ${token}`;
    };
    return config;
});

// `interceptors.response.use` intercepts all response to deal with 401 forbidden error in one place.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
            // Prevents renewal loop when 401 error occurs.
            // '_' is prefix of Axios internal customizing flag.
            original._retry = true;

            // `useAuthStore.getState()` accesses to Zustand status outside from React as interceptor cannot use hook outside from React component.
            const { refreshToken, setTokens } = useAuthStore.getState();
            const { data } = await api.post('/auth/token/refreshaccess', null, {
                headers: { Authorization: `Bearer ${refreshToken}` },
            });

            const { sub } = jwtDecode<{ sub: number }>(data.accessToken);
            setTokens(data.accessToken, refreshToken!, sub);
            original.headers.Authorization = `Bearer ${data.accessToken}`;

            // Automatically restart previously failed request after client's renewal of token.
            return api(original);
        };

        return Promise.reject(error);
    },
);

export default api;
