import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "../store/auth.store";
import { reconnectSocket, socket } from "../socket/socket";
import DOMpurify from 'dompurify';
import { useNavigate } from "react-router-dom";
import { useLazyQuery, useMutation, useQuery, useSubscription } from "@apollo/client/react";
import {
    SEND_MESSAGE, RECEIVE_MESSAGE, GET_ONLINE_USERS, GET_MESSAGES,
    GET_ROOM, GET_MY_ROOMS, GET_AI_USER_ID, SET_AI_PERSONALITY, GET_AI_PERSONALITY_INFO,
} from "../api/graphql-operations";
import AiPersonalitySelector from "../components/ai-personality-selector";

interface Message {
    id?: number;
    userId: number;
    message: string;
    roomId: number;
    createdAt?: string;
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
        createdAt: string;
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

interface MyRoomsData {
    getMyRooms: Array<{
        roomId: number;
        recipientId: number;
    }>;
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

    const [pendingPersonality, setPendingPersonality] = useState<string | null>(null);
    const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
    const [isInitialSelect, setIsInitialSelect] = useState(true);
    const [aiPersonalityInfo, setAiPersonalityInfo] = useState<{ personality: string | null; canChange: boolean } | null>(null);
    // true only when user explicitly clicks AI Chat (not on page load)
    const shouldCheckPersonalityRef = useRef(false);
    // smart scroll: true when user is near the bottom
    const isAtBottomRef = useRef(true);

    const [sendMessageMutation] = useMutation<SendMessageData>(SEND_MESSAGE);
    const { data: subData } = useSubscription<SubscriptionData>(RECEIVE_MESSAGE, {
        variables: { roomId: currentRoomId },
        skip: !currentRoomId,
    });
    const { data: onlineData } = useQuery<OnlineUsersData>(GET_ONLINE_USERS, {
        pollInterval: 5000,
    });
    const [fetchMessages] = useLazyQuery<GetMessagesData>(GET_MESSAGES, { fetchPolicy: 'network-only' });
    const [fetchRoom] = useLazyQuery<{ getRoom: number | null }>(GET_ROOM, { fetchPolicy: 'network-only' });
    const { data: myRoomsData, refetch: refetchRooms } = useQuery<MyRoomsData>(GET_MY_ROOMS, { fetchPolicy: 'network-only' });

    const { data: aiUserData } = useQuery<{ getAiUserId: number }>(GET_AI_USER_ID);
    const aiUserId = aiUserData?.getAiUserId ?? null;
    const [fetchAiPersonalityInfo] = useLazyQuery<{ getAiPersonalityInfo: { personality: string | null; canChange: boolean } }>(
        GET_AI_PERSONALITY_INFO, { fetchPolicy: 'network-only' }
    );
    const [setAiPersonalityMutation] = useMutation<{ setAiPersonality: boolean }>(SET_AI_PERSONALITY);

    useEffect(() => {
        if (!recipientId) return;
        setCurrentRoomId(null);
        setMessages([]);
        setHasMore(true);
        setAiPersonalityInfo(null);
        fetchRoom({ variables: { recipientId } }).then(({ data }) => {
            if (data?.getRoom) {
                setCurrentRoomId(data.getRoom);
                // keep ref alive so the personality effect can use it
            } else if (shouldCheckPersonalityRef.current && aiUserId && recipientId === aiUserId && !pendingPersonality) {
                // no room yet → show selector (only when user explicitly clicked)
                setIsInitialSelect(true);
                setShowPersonalitySelector(true);
                shouldCheckPersonalityRef.current = false;
            } else {
                shouldCheckPersonalityRef.current = false;
            }
        });
    }, [recipientId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load personality info when an existing AI room is opened
    useEffect(() => {
        if (!currentRoomId || !aiUserId || recipientId !== aiUserId) return;
        fetchAiPersonalityInfo({ variables: { roomId: currentRoomId } }).then(({ data }) => {
            if (data?.getAiPersonalityInfo) {
                setAiPersonalityInfo(data.getAiPersonalityInfo);
                // show selector if no personality set and user explicitly clicked
                if (!data.getAiPersonalityInfo.personality && shouldCheckPersonalityRef.current) {
                    setIsInitialSelect(true);
                    setShowPersonalitySelector(true);
                }
                shouldCheckPersonalityRef.current = false;
            }
        });
    }, [currentRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadMessages = useCallback(async (roomId: number, cursor?: number) => {
        const { data } = await fetchMessages({ variables: { roomId, cursor } });
        if (!data?.getMessages) return;

        const incoming: Message[] = data.getMessages.map(m => ({
            id: Number(m.id),
            userId: Number(m.participant?.id),
            message: m.message,
            roomId,
            createdAt: m.createdAt,
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
        isAtBottomRef.current = true;
        loadMessages(currentRoomId);
    }, [currentRoomId]);

    // Auto-scroll to bottom on new messages — only when already near bottom
    useEffect(() => {
        if (!scrollRef.current || messages.length === 0 || !isAtBottomRef.current) return;
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    // Scroll handler: track bottom proximity + load older messages at top
    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const el = scrollRef.current;
        isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (!currentRoomId || !hasMore) return;
        if (el.scrollTop === 0) {
            const oldestId = messages.find(m => m.id)?.id;
            if (oldestId) loadMessages(currentRoomId, Number(oldestId));
        }
    }, [currentRoomId, hasMore, messages, loadMessages]);

    // Reload messages on socket reconnect (network drop recovery)
    useEffect(() => {
        if (!currentRoomId) return;
        const handleConnect = () => loadMessages(currentRoomId);
        socket.on('connect', handleConnect);
        return () => { socket.off('connect', handleConnect); };
    }, [currentRoomId, loadMessages]);

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
                createdAt: new Date().toISOString(),
            }];
        });
    }, [subData]);

    useEffect(() => {
        if (!accessToken) return;

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

        const isAiChat = aiUserId !== null && recipientId === aiUserId;
        const aiPersonalityToSend = isAiChat ? pendingPersonality : undefined;

        const { data } = await sendMessageMutation({
            variables: {
                input: {
                    message: input,
                    room: currentRoomId ?? undefined,
                    recipientId,
                    ...(aiPersonalityToSend ? { aiPersonality: aiPersonalityToSend } : {}),
                },
                recipientId,
            },
        });

        const newRoomId = data?.sendMessage?.roomId;

        if (!currentRoomId && newRoomId) {
            setCurrentRoomId(newRoomId);
            refetchRooms();
            // Personality is now stored in DB — clear pending
            if (isAiChat) setPendingPersonality(null);
        }

        setMessages(prev => [...prev, {
            id: data?.sendMessage?.id,
            userId: userId!,
            message: input,
            roomId: currentRoomId ?? newRoomId!,
            createdAt: data?.sendMessage?.createdAt ?? new Date().toISOString(),
        }]);

        setInput('');
    };

    const handlePersonalitySelect = async (personality: string) => {
        setShowPersonalitySelector(false);
        if (isInitialSelect) {
            setPendingPersonality(personality);
        } else if (currentRoomId) {
            await setAiPersonalityMutation({ variables: { roomId: currentRoomId, personality } });
            setAiPersonalityInfo(prev => prev ? { ...prev, personality } : null);
        }
    };

    const handleAiChatClick = () => {
        if (!aiUserId) return;
        shouldCheckPersonalityRef.current = true;
        setRecipientId(aiUserId);
        setLastRecipientId(aiUserId);
    };

    const formatTime = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
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
            <div className="flex gap-2 mb-4 flex-wrap items-center">
                <span className="text-xs text-gray-400">Conversations:</span>
                {onlineData?.getOnlineUser
                    ?.filter((id: number) => id !== aiUserId)
                    .map((id: number) => (
                        <span
                            key={`u-${id}`}
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
                {recipientId && recipientId !== aiUserId && !onlineData?.getOnlineUser?.includes(recipientId) && (
                    <span className="px-3 py-1 rounded-full text-sm bg-blue-400 text-white opacity-50 cursor-default">
                        ✓ User {recipientId} (offline)
                    </span>
                )}
                {myRoomsData?.getMyRooms
                    ?.filter(({ recipientId: rid }) =>
                        rid !== aiUserId &&
                        !onlineData?.getOnlineUser?.includes(rid) &&
                        rid !== recipientId
                    )
                    .map(({ roomId, recipientId: rid }) => (
                        <span
                            key={roomId}
                            onClick={() => { setRecipientId(rid); setLastRecipientId(rid); }}
                            className="px-3 py-1 rounded-full text-sm cursor-pointer border bg-white border-gray-300 hover:bg-gray-50"
                        >
                            User {rid} (offline)
                        </span>
                    ))}
                {/* AI Chat — always shown at the end */}
                {aiUserId && (
                    <span
                        onClick={handleAiChatClick}
                        className={`px-3 py-1 rounded-full text-sm cursor-pointer border ${
                            recipientId === aiUserId
                                ? 'bg-purple-500 text-white border-purple-500'
                                : 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                        }`}
                    >
                        {recipientId === aiUserId ? '✓ AI Chat' : 'AI Chat'}
                    </span>
                )}
                {/* Personality change button — shown when in active AI chat */}
                {recipientId === aiUserId && currentRoomId && (
                    <button
                        onClick={() => { setIsInitialSelect(false); setShowPersonalitySelector(true); }}
                        className="text-xs text-purple-500 underline ml-1"
                    >
                        성격 변경
                    </button>
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
                        className={`flex flex-col max-w-xs ${msg.userId === userId ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                        <div
                            className={`p-2 rounded ${msg.userId === userId ? 'bg-blue-100' : 'bg-gray-100'}`}
                            dangerouslySetInnerHTML={{ __html: DOMpurify.sanitize(msg.message) }}
                        />
                        {msg.createdAt && (
                            <span className="text-xs text-gray-400 mt-0.5">{formatTime(msg.createdAt)}</span>
                        )}
                    </div>
                ))}
            </div>
            {showPersonalitySelector && (
            <AiPersonalitySelector
                currentPersonality={isInitialSelect ? pendingPersonality : aiPersonalityInfo?.personality}
                canChange={isInitialSelect || (aiPersonalityInfo?.canChange ?? false)}
                onSelect={handlePersonalitySelect}
                onClose={() => setShowPersonalitySelector(false)}
                isInitial={isInitialSelect}
            />
        )}
        <div className="flex gap-2 mt-4">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
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
