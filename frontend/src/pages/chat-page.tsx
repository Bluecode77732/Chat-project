import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "../store/auth.store";
import { reconnectSocket, socket } from "../socket/socket";
import DOMpurify from 'dompurify';
import { useNavigate } from "react-router-dom";
import { useLazyQuery, useMutation, useQuery, useSubscription } from "@apollo/client/react";
import { SEND_MESSAGE, RECEIVE_MESSAGE, GET_ONLINE_USERS, GET_MESSAGES, GET_ROOM } from "../api/graphql-operations";

interface Message {
    id?: number;
    userId: number;
    message: string;
    roomId: number;
}

interface SubscriptionData {
    receiveMessage: {
        id: number;
        message: string;
        participant: { id: number };
    };
}

interface SendMessageData {
    sendMessage: {
        id: number;
        message: string;
        participant: { id: number };
        roomId: number;
    };
}

interface GetMessagesData {
    getMessages: Array<{
        id: number;
        message: string;
        participant: { id: number };
        createdAt: string;
    }>;
}

interface OnlineUsersData {
    getOnlineUser: number[];
}

function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { clearTokens, lastRecipientId, setLastRecipientId } = useAuthStore();
    const { accessToken, userId } = useAuthStore();
    const [recipientId, setRecipientId] = useState<number | null>(lastRecipientId);
    const navigate = useNavigate();

    const [sendMessageMutation] = useMutation<SendMessageData>(SEND_MESSAGE);
    const { data: subData } = useSubscription<SubscriptionData>(RECEIVE_MESSAGE, {
        variables: { roomId: currentRoomId },
        skip: !currentRoomId,
    });
    const { data: onlineData } = useQuery<OnlineUsersData>(GET_ONLINE_USERS, {
        pollInterval: 5000,
    });
    const [fetchMessages] = useLazyQuery<GetMessagesData>(GET_MESSAGES);
    const [fetchRoom] = useLazyQuery<{ getRoom: number | null }>(GET_ROOM);

    useEffect(() => {
        if (!recipientId) return;
        setCurrentRoomId(null);
        setMessages([]);
        setHasMore(true);
        fetchRoom({ variables: { recipientId } }).then(({ data }) => {
            if (data?.getRoom) setCurrentRoomId(data.getRoom);
        });
    }, [recipientId]);

    const loadMessages = useCallback(async (roomId: number, cursor?: number) => {
        const { data } = await fetchMessages({ variables: { roomId, cursor } });
        if (!data?.getMessages) return;

        const incoming: Message[] = data.getMessages.map(m => ({
            id: m.id,
            userId: Number(m.participant?.id),
            message: m.message,
            roomId,
        }));

        if (incoming.length < 15) setHasMore(false);

        if (cursor) {
            // Prepend older messages, avoid duplicates
            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id).filter(Boolean));
                return [...incoming.filter(m => !existingIds.has(m.id)), ...prev];
            });
        } else {
            // Initial load: replace state, keep any locally added messages not yet in DB
            setMessages(prev => {
                const historyIds = new Set(incoming.map(m => m.id));
                const localOnly = prev.filter(m => !m.id || !historyIds.has(m.id));
                return [...incoming, ...localOnly];
            });
        }
    }, [fetchMessages]);

    // Load message history when room is first known
    useEffect(() => {
        if (!currentRoomId) return;
        setHasMore(true);
        loadMessages(currentRoomId);
    }, [currentRoomId]);

    // Scroll to top → load more
    const handleScroll = useCallback(() => {
        if (!scrollRef.current || !currentRoomId || !hasMore) return;
        if (scrollRef.current.scrollTop === 0) {
            const oldestId = messages.find(m => m.id)?.id;
            loadMessages(currentRoomId, oldestId);
        }
    }, [currentRoomId, hasMore, messages, loadMessages]);

    // Incoming messages from subscription (others only)
    useEffect(() => {
        if (!subData?.receiveMessage) return;
        const senderId = Number(subData.receiveMessage.participant?.id);
        if (senderId === userId) return;

        setMessages(prev => {
            if (prev.some(m => m.id === subData.receiveMessage.id)) return prev;
            return [...prev, {
                id: subData.receiveMessage.id,
                userId: senderId,
                message: subData.receiveMessage.message,
                roomId: currentRoomId!,
            }];
        });
    }, [subData]);

    useEffect(() => {
        reconnectSocket();

        socket.on('CreateRoom', (roomId: string) => {
            setCurrentRoomId(Number(roomId));
        });

        socket.on('connect_error', (err) => {
            console.error('Socket has failed to connect: ', err.message);
        });

        return () => {
            socket.off('CreateRoom');
            socket.off('connect_error');
            socket.disconnect();
        };
    }, [accessToken]);

    const sendMessage = async () => {
        if (!input.trim() || !recipientId) return;

        const { data } = await sendMessageMutation({
            variables: {
                input: { message: input, room: currentRoomId ?? undefined, recipientId },
                recipientId,
            },
        });

        const newRoomId = data?.sendMessage?.roomId;

        if (!currentRoomId && newRoomId) {
            setCurrentRoomId(newRoomId);
        }

        setMessages(prev => [...prev, {
            id: data?.sendMessage?.id,
            userId: userId!,
            message: input,
            roomId: currentRoomId ?? newRoomId!,
        }]);

        setInput('');
    };

    const signOut = () => {
        socket.disconnect();
        clearTokens();
        navigate('/');
    };

    return (
        <div className="flex flex-col h-screen p-4">
            <div className="flex justify-between items-center mb-4">
                <span className="font-bold">Chat</span>
                <button onClick={signOut} className="text-red-500 text-sm">
                    Sign Out
                </button>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
                {onlineData?.getOnlineUser?.map((id: number) => (
                    <span
                        key={id}
                        onClick={() => { if (id !== userId) { setRecipientId(id); setLastRecipientId(id); } }}
                        className={`px-3 py-1 rounded-full text-sm cursor-pointer ${
                            id === userId
                                ? 'bg-green-200 cursor-default'
                                : id === recipientId
                                    ? 'bg-blue-400 text-white'
                                    : 'bg-gray-200 hover:bg-blue-100'
                        }`}
                    >
                        {id === userId ? `Me (${id})` : id === recipientId ? `✓ User ${id}` : `User ${id}`}
                    </span>
                ))}
                {recipientId && !onlineData?.getOnlineUser?.includes(recipientId) && (
                    <span className="px-3 py-1 rounded-full text-sm bg-blue-400 text-white opacity-50 cursor-default">
                        ✓ User {recipientId} (offline)
                    </span>
                )}
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto flex flex-col gap-2"
            >
                {messages.map((msg, i) => (
                    <div
                        key={msg.id ?? i}
                        className={`p-2 rounded max-w-xs ${msg.userId === userId
                            ? 'bg-blue-100 ml-auto'
                            : 'bg-gray-100 mr-auto'
                        }`}
                        dangerouslySetInnerHTML={{
                            __html: DOMpurify.sanitize(msg.message),
                        }}
                    />
                ))}
            </div>
            <div className="flex gap-2 mt-4">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 border p-2 rounded"
                    placeholder="Type Message"
                />
                <button
                    onClick={sendMessage}
                    className="bg-blue-500 text-white px-4 rounded"
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default ChatPage;
