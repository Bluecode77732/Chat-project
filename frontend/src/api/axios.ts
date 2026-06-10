import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;

            try {
                const { setTokens } = useAuthStore.getState();
                // refreshToken cookie is sent automatically via withCredentials
                const { data } = await api.post('/auth/token/refreshaccess');
                const { sub } = jwtDecode<{ sub: number }>(data.accessToken);
                setTokens(data.accessToken, sub);
                original.headers.Authorization = `Bearer ${data.accessToken}`;
                return api(original);
            } catch {
                useAuthStore.getState().clearTokens();
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    },
);

export default api;
