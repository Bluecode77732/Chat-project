import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';
import { Socket } from 'socket.io-client';

const createSocket = () =>
    // `io` connection to `@WebSocketGateway()` in 'chat.gateway'.
    io(import.meta.env.VITE_API_URL, {
        autoConnect: false,
        forceNew: true,
        extraHeaders: {
            authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        },
    });

// `createSocket()` for Issuing of new socket via renewal of token.
// Using same `socket` instance on any component for global share of it.
export let socket: Socket = createSocket();

// `reconnectSocket()` reconnection of socket in renewal of access token.
export const reconnectSocket = () => {
    socket.disconnect();
    socket = createSocket();
    socket.connect();
};
