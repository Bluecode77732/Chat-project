import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';
import { Socket } from 'socket.io-client';
import { rejectSessionConflict } from '../auth/session-guard';

const createSocket = () => {
    // `io` connection to `@WebSocketGateway()` in 'chat.gateway'.
    const newSocket = io(import.meta.env.VITE_API_URL, {
        autoConnect: false,
        forceNew: true,
        extraHeaders: {
            authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        },
    });

    // Backend kicks this socket when the same account signs in elsewhere —
    // tear down locally right away instead of waiting on the next refresh.
    newSocket.on('forceLogout', () => {
        rejectSessionConflict();
    });

    return newSocket;
};

// `createSocket()` for Issuing of new socket via renewal of token.
// Using same `socket` instance on any component for global share of it.
export let socket: Socket = createSocket();

// `reconnectSocket()` reconnection of socket in renewal of access token.
export const reconnectSocket = () => {
    socket.disconnect();
    socket = createSocket();
    socket.connect();
};
