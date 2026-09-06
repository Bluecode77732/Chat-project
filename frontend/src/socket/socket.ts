import { io } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';
import { Socket } from 'socket.io-client';
import { rejectSessionConflict } from '../auth/session-guard';

const createSocket = () => {
    // 'chat.gateway'의 `@WebSocketGateway()`로 연결하는 `io` 소켓.
    const newSocket = io(import.meta.env.VITE_API_URL, {
        autoConnect: false,
        forceNew: true,
        extraHeaders: {
            authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        },
    });

    // 같은 계정이 다른 곳에서 로그인하면 백엔드가 이 소켓을 끊음 —
    // 다음 refresh를 기다리지 않고 로컬에서 바로 정리.
    newSocket.on('forceLogout', () => {
        rejectSessionConflict();
    });

    return newSocket;
};

// 토큰 갱신 시 새 소켓을 발급하기 위한 `createSocket()`.
// 모든 컴포넌트가 전역으로 공유하도록 동일한 `socket` 인스턴스를 사용.
export let socket: Socket = createSocket();

// Socket.IO는 살아있는 연결에서 auth 헤더를 교체할 수 없어서, 재연결은
// connect()를 다시 호출하는 게 아니라 이 인스턴스를 버리고 새로 만드는 것을 뜻함.
export const reconnectSocket = () => {
    socket.disconnect();
    socket = createSocket();
    socket.connect();
};
