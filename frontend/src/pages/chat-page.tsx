import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "../store/auth.store";
import { reconnectSocket, socket } from "../socket/socket";
import api from "../api/axios";
import { clearSessionUser, refreshAccessTokenSafely } from "../auth/session-guard";
import DOMpurify from 'dompurify';
import { useNavigate } from "react-router-dom";
import { useLazyQuery, useMutation, useQuery, useSubscription } from "@apollo/client/react";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import {
    SEND_MESSAGE, RECEIVE_MESSAGE, GET_ONLINE_USERS, GET_ALL_USERS, GET_MESSAGES,
    GET_ROOM, GET_MY_ROOMS, GET_AI_USER_ID, SET_AI_PERSONALITY, GET_AI_PERSONALITY_INFO,
    GET_USER_NICKNAMES,
    SendMessageVariables,
} from "../api/graphql-operations";
import AiPersonalitySelector from "../components/ai-personality-selector";
import RateLimitNotice from "../components/rate-limit-notice";
import EmptyStateNotice from "../components/empty-state-notice";

const RATE_LIMIT_WINDOW_SECONDS = 15;

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

interface AllUsersData {
    getAllUsers: number[];
}

interface UserNicknamesData {
    getUserNicknames: Array<{ id: string; nickname: string | null; profileImage: string | null }>;
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
    const [messagesLoading, setMessagesLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { clearTokens, lastRecipientId, setLastRecipientId } = useAuthStore();
    const { accessToken, userId } = useAuthStore();
    const [recipientId, setRecipientId] = useState<number | null>(lastRecipientId);
    const [hideEmptyNotice, setHideEmptyNotice] = useState(() => localStorage.getItem('hideEmptyChatNotice') === 'true');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const navigate = useNavigate();

    const [rateLimitSecondsLeft, setRateLimitSecondsLeft] = useState<number | null>(null);
    const [pendingPersonality, setPendingPersonality] = useState<string | null>(null);
    const [showPersonalitySelector, setShowPersonalitySelector] = useState(false);
    const [isInitialSelect, setIsInitialSelect] = useState(true);
    const [aiPersonalityInfo, setAiPersonalityInfo] = useState<{ personality: string | null; canChange: boolean } | null>(null);
    // true only when user explicitly clicks AI Chat (not on page load)
    const shouldCheckPersonalityRef = useRef(false);
    // smart scroll: true when user is near the bottom
    const isAtBottomRef = useRef(true);
    const bannerRef = useRef<HTMLDivElement>(null);
    const [canScrollBannerLeft, setCanScrollBannerLeft] = useState(false);
    const [canScrollBannerRight, setCanScrollBannerRight] = useState(false);
    const holdTimerRef = useRef<number | null>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const isHoldingRef = useRef(false);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const [sendMessageMutation] = useMutation<SendMessageData, SendMessageVariables>(SEND_MESSAGE);
    const { data: subData } = useSubscription<SubscriptionData>(RECEIVE_MESSAGE, {
        variables: { roomId: currentRoomId },
        skip: !currentRoomId,
    });
    const { data: onlineData } = useQuery<OnlineUsersData>(GET_ONLINE_USERS, {
        pollInterval: 5000,
    });
    const { data: allUsersData } = useQuery<AllUsersData>(GET_ALL_USERS, {
        pollInterval: 60000,
    });
    const { data: nicknamesData } = useQuery<UserNicknamesData>(GET_USER_NICKNAMES, {
        pollInterval: 60000,
    });
    const nicknameById = new Map(
        nicknamesData?.getUserNicknames.map((u) => [Number(u.id), u.nickname]) ?? []
    );
    const profileImageById = new Map(
        nicknamesData?.getUserNicknames.map((u) => [Number(u.id), u.profileImage]) ?? []
    );
    const displayName = (id: number) => nicknameById.get(id) || `User ${id}`;
    const [fetchMessages] = useLazyQuery<GetMessagesData>(GET_MESSAGES, { fetchPolicy: 'network-only' });
    const [fetchRoom] = useLazyQuery<{ getRoom: number | null }>(GET_ROOM, { fetchPolicy: 'network-only' });
    const { data: myRoomsData, refetch: refetchRooms } = useQuery<MyRoomsData>(GET_MY_ROOMS, { fetchPolicy: 'network-only' });

    const { data: aiUserData } = useQuery<{ getAiUserId: number }>(GET_AI_USER_ID);
    const aiUserId = aiUserData?.getAiUserId ?? null;
    const initials = (id: number) => (aiUserId !== null && id === aiUserId) ? 'AI' : displayName(id).slice(0, 2);
    // iMessage-style tail: a small same-color blob plus a page-background-color mask curving part of it away.
    const bubbleTailClass = (isMine: boolean) =>
        isMine
            ? "before:content-[''] before:absolute before:bottom-[-2px] before:right-[-7px] before:w-[15px] before:h-[15px] before:bg-blue-100 before:rounded-bl-[15px] after:content-[''] after:absolute after:bottom-[-2px] after:right-[-10px] after:w-[10px] after:h-[15px] after:bg-white after:rounded-bl-[10px]"
            : "before:content-[''] before:absolute before:bottom-[-2px] before:left-[-7px] before:w-[15px] before:h-[15px] before:bg-gray-100 before:rounded-br-[15px] after:content-[''] after:absolute after:bottom-[-2px] after:left-[-10px] after:w-[10px] after:h-[15px] after:bg-white after:rounded-br-[10px]";
    const [fetchAiPersonalityInfo] = useLazyQuery<{ getAiPersonalityInfo: { personality: string | null; canChange: boolean } }>(
        GET_AI_PERSONALITY_INFO, { fetchPolicy: 'network-only' }
    );
    const [setAiPersonalityMutation] = useMutation<{ setAiPersonality: boolean }>(SET_AI_PERSONALITY);

    useEffect(() => {
        const handleSlashFocus = (e: KeyboardEvent) => {
            if (e.key !== '/') return;
            if (showPersonalitySelector) return;
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
            if (isTyping) return;
            e.preventDefault();
            messageInputRef.current?.focus();
        };
        document.addEventListener('keydown', handleSlashFocus);
        return () => document.removeEventListener('keydown', handleSlashFocus);
    }, [showPersonalitySelector]);

    // Auto-grow the message textarea with its content, capped by max-h-32 (matches the CSS cap).
    // Measuring requires a transient height:auto, but applying the result in the same tick gives the
    // browser no "previous" frame to transition from — it just jumps. Restoring prevHeight and forcing
    // a reflow (reading offsetHeight) commits that state before we write the new height, so the
    // browser actually has two distinct values to animate between.
    useEffect(() => {
        const textarea = messageInputRef.current;
        if (!textarea) return;
        const prevHeight = textarea.style.height;
        textarea.style.height = 'auto';
        const next = `${Math.min(textarea.scrollHeight, 128)}px`;
        textarea.style.height = prevHeight;
        void textarea.offsetHeight;
        textarea.style.height = next;
    }, [input]);

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
        }).catch(console.error);
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
        }).catch(console.error);
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
        setMessagesLoading(true);
        loadMessages(currentRoomId)
            .catch(console.error)
            .finally(() => setMessagesLoading(false));
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
            if (oldestId) loadMessages(currentRoomId, Number(oldestId)).catch(console.error);
        }
    }, [currentRoomId, hasMore, messages, loadMessages]);

    // Reload messages on socket reconnect (network drop recovery)
    useEffect(() => {
        if (!currentRoomId) return;
        const handleConnect = () => loadMessages(currentRoomId);
        socket.on('connect', handleConnect);
        return () => { socket.off('connect', handleConnect); };
    }, [currentRoomId, loadMessages]);

    // Auto-scroll banner to selected user badge
    useEffect(() => {
        if (!recipientId || !bannerRef.current) return;
        const target = bannerRef.current.querySelector(`[data-userid="${recipientId}"]`) as HTMLElement | null;
        if (!target) return;
        const container = bannerRef.current;
        const centerOffset = target.offsetLeft - container.offsetWidth / 2 + target.offsetWidth / 2;
        container.scrollTo({ left: centerOffset, behavior: 'smooth' });
    }, [recipientId]);

    // Cleanup banner scroll timers on unmount
    useEffect(() => {
        return () => {
            if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
            if (scrollIntervalRef.current !== null) clearInterval(scrollIntervalRef.current);
        };
    }, []);

    // Incoming messages from subscription (others only)
    useEffect(() => {
        if (!subData?.receiveMessage) return;
        const senderId = Number(subData.receiveMessage.participant?.id);
        if (senderId === userId) return;

        setMessages(prev => {
            if (!currentRoomId) return prev;
            if (prev.some(m => m.id === subData.receiveMessage.id)) return prev;
            return [...prev, {
                id: Number(subData.receiveMessage.id),
                userId: senderId,
                message: subData.receiveMessage.message,
                roomId: currentRoomId,
                createdAt: new Date().toISOString(),
            }];
        });
    }, [subData]);

    useEffect(() => {
        if (!accessToken) return;

        reconnectSocket();

        socket.on('CreateRoom', (roomId: string) => {
            setCurrentRoomId(Number(roomId));
            refetchRooms();
        });

        socket.on('connect_error', (err) => {
            console.error('Socket has failed to connect: ', err.message);
            // Refresh first: if the refresh token is also expired, refreshAccessTokenSafely()
            // triggers rejectSession() (logout) internally, so we must not blindly retry the
            // same stale token forever.
            refreshAccessTokenSafely().then((accessToken) => {
                if (!accessToken) return;
                setTimeout(() => reconnectSocket(), 3000);
            });
        });

        return () => {
            socket.off('CreateRoom');
            socket.off('connect_error');
            socket.disconnect();
        };
    }, [accessToken]);

    // Rate-limit modal countdown: ticks down once per second, auto-closes at 0
    useEffect(() => {
        if (rateLimitSecondsLeft === null) return;
        const timer = window.setTimeout(() => {
            setRateLimitSecondsLeft(s => (s !== null && s > 1) ? s - 1 : null);
        }, 1000);
        return () => clearTimeout(timer);
    }, [rateLimitSecondsLeft]);

    const sendMessage = async () => {
        if (!input.trim() || !recipientId || !userId || rateLimitSecondsLeft !== null) return;

        const isAiChat = aiUserId !== null && recipientId === aiUserId;
        const aiPersonalityToSend = isAiChat ? pendingPersonality : undefined;

        let data: SendMessageData | null | undefined;
        try {
            ({ data } = await sendMessageMutation({
                variables: {
                    input: {
                        message: input,
                        ...(aiPersonalityToSend ? { aiPersonality: aiPersonalityToSend } : {}),
                    },
                    recipientId,
                },
            }));
        } catch (err) {
            if (CombinedGraphQLErrors.is(err) &&
                err.errors.some(e => e.extensions?.['code'] === 'TOO_MANY_REQUESTS')) {
                setRateLimitSecondsLeft(RATE_LIMIT_WINDOW_SECONDS);
                return;
            }
            throw err;
        }

        const newRoomId = data?.sendMessage?.roomId;

        if (!currentRoomId && newRoomId) {
            setCurrentRoomId(newRoomId);
            refetchRooms();
            // Personality is now stored in DB — clear pending
            if (isAiChat) setPendingPersonality(null);
        }

        const effectiveRoomId = currentRoomId ?? newRoomId;
        if (!effectiveRoomId) return;

        setMessages(prev => [...prev, {
            id: data?.sendMessage?.id !== undefined ? Number(data.sendMessage.id) : undefined,
            userId,
            message: input,
            roomId: effectiveRoomId,
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

    const dismissEmptyNotice = () => {
        localStorage.setItem('hideEmptyChatNotice', 'true');
        setHideEmptyNotice(true);
    };

    const handleScrollMouseDown = useCallback((direction: 'left' | 'right') => {
        holdTimerRef.current = window.setTimeout(() => {
            isHoldingRef.current = true;
            const delta = direction === 'right' ? 6 : -6;
            scrollIntervalRef.current = window.setInterval(() => {
                if (bannerRef.current) bannerRef.current.scrollLeft += delta;
            }, 16);
        }, 300);
    }, []);

    const stopScroll = useCallback(() => {
        if (holdTimerRef.current !== null) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        if (scrollIntervalRef.current !== null) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
        isHoldingRef.current = false;
    }, []);

    const handleScrollMouseUp = useCallback((direction: 'left' | 'right') => {
        const wasHolding = isHoldingRef.current;
        stopScroll();
        if (!wasHolding) {
            bannerRef.current?.scrollBy({ left: direction === 'right' ? 200 : -200, behavior: 'smooth' });
        }
    }, [stopScroll]);

    const updateBannerScrollState = useCallback(() => {
        const el = bannerRef.current;
        if (!el) return;
        setCanScrollBannerLeft(el.scrollLeft > 1);
        setCanScrollBannerRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }, []);

    // Re-measure whenever the banner's content (and therefore its scrollWidth) can change.
    useEffect(() => {
        updateBannerScrollState();
    }, [updateBannerScrollState, onlineData, allUsersData, userSearchQuery, recipientId, nicknamesData]);

    useEffect(() => {
        window.addEventListener('resize', updateBannerScrollState);
        return () => window.removeEventListener('resize', updateBannerScrollState);
    }, [updateBannerScrollState]);

    const formatTime = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    const signOut = async () => {
        try {
            await api.post('/auth/signOut');
        } catch {
            // token already expired — still clear local state and cookie
        }
        socket.disconnect();
        clearTokens();
        clearSessionUser();
        navigate('/');
    };

    return (
        <div className="flex flex-col h-screen p-4">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
                <span className="text-2xl italic bg-linear-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300 }}>Chatterley</span>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/account')} data-testid="chat-account-button" className="text-gray-500 text-sm hover:text-gray-700" style={{ fontFamily: "'Cormorant Garamond', 'Hahmlet', serif" }}>
                        계정
                    </button>
                    <button onClick={signOut} data-testid="chat-signout-button" className="text-red-500 text-sm" style={{ fontFamily: "'Cormorant Garamond', 'Hahmlet', serif" }}>
                        로그아웃
                    </button>
                </div>
            </div>
            <div className="flex gap-2 mb-4 items-center">
                <span className="hidden sm:inline text-base text-gray-400 shrink-0" style={{ fontFamily: "'Cormorant Garamond', 'Hahmlet', serif" }}>Conversations:</span>
                <input
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    data-testid="chat-user-search-input"
                    placeholder="유저 검색"
                    style={{ fontFamily: "'Cormorant Garamond', 'Hahmlet', serif" }}
                    className="shrink-0 w-16 sm:w-28 text-xs text-center border rounded-full px-3 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                <button
                    onMouseDown={() => handleScrollMouseDown('left')}
                    onMouseUp={() => handleScrollMouseUp('left')}
                    onMouseLeave={stopScroll}
                    data-testid="chat-scroll-left-button"
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 select-none"
                >
                    ‹
                </button>
                <div className="relative flex-1 overflow-hidden">
                    {canScrollBannerLeft && (
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-white to-transparent z-10" />
                    )}
                    {canScrollBannerRight && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-white to-transparent z-10" />
                    )}
                    <div ref={bannerRef} onScroll={updateBannerScrollState} className="flex gap-2 overflow-x-hidden">
                    {(() => {
                        const onlineIds = new Set(onlineData?.getOnlineUser ?? []);
                        const myRoomUserIds = new Set(myRoomsData?.getMyRooms?.map(r => r.recipientId) ?? []);
                        const query = userSearchQuery.trim().toLowerCase();
                        return (
                            <>
                                {/* Online users (including Me) */}
                                {onlineData?.getOnlineUser
                                    ?.filter((id: number) => id !== aiUserId)
                                    .filter((id: number) => id === userId || !query || displayName(id).toLowerCase().includes(query))
                                    .slice()
                                    .sort((a, b) => (a === userId ? -1 : b === userId ? 1 : 0))
                                    .map((id: number) => (
                                        <span
                                            key={`online-${id}`}
                                            data-userid={id}
                                            onClick={() => { if (id !== userId) { setRecipientId(id); setLastRecipientId(id); } }}
                                            className={`shrink-0 px-3 py-1 rounded-full text-sm cursor-pointer ${
                                                id === userId
                                                    ? 'bg-green-200 cursor-default'
                                                    : id === recipientId
                                                        ? 'bg-blue-400 text-white'
                                                        : 'bg-gray-200 hover:bg-blue-100'
                                            }`}
                                        >
                                            {id === userId ? `Me (${displayName(id)})` : id === recipientId ? `✓ ${displayName(id)}` : displayName(id)}
                                        </span>
                                    ))}
                                {/* Offline users — all registered users not currently online */}
                                {allUsersData?.getAllUsers
                                    ?.filter((id) => id !== aiUserId && !onlineIds.has(id))
                                    .filter((id) => !query || displayName(id).toLowerCase().includes(query))
                                    .map((id) => (
                                        <span
                                            key={`offline-${id}`}
                                            data-userid={id}
                                            onClick={() => { setRecipientId(id); setLastRecipientId(id); }}
                                            className={`shrink-0 px-3 py-1 rounded-full text-sm cursor-pointer ${
                                                id === recipientId
                                                    ? 'bg-blue-400 text-white'
                                                    : myRoomUserIds.has(id)
                                                        ? 'border bg-white border-gray-300 hover:bg-gray-50'
                                                        : 'border border-dashed bg-gray-50 text-gray-400 hover:bg-gray-100'
                                            }`}
                                        >
                                            {id === recipientId ? `✓ ${displayName(id)} (offline)` : `${displayName(id)} (offline)`}
                                        </span>
                                    ))}
                                {/* AI Chat */}
                                {aiUserId && (
                                    <span
                                        data-userid={aiUserId}
                                        onClick={handleAiChatClick}
                                        className={`shrink-0 px-3 py-1 rounded-full text-sm cursor-pointer border ${
                                            recipientId === aiUserId
                                                ? 'bg-purple-500 text-white border-purple-500'
                                                : 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                                        }`}
                                    >
                                        {recipientId === aiUserId ? '✓ AI Chat' : 'AI Chat'}
                                    </span>
                                )}
                                {/* Personality change button */}
                                {recipientId === aiUserId && currentRoomId && (
                                    <button
                                        onClick={() => { setIsInitialSelect(false); setShowPersonalitySelector(true); }}
                                        className="shrink-0 text-xs text-purple-500 underline"
                                    >
                                        성격 변경
                                    </button>
                                )}
                            </>
                        );
                    })()}
                    </div>
                </div>
                <button
                    onMouseDown={() => handleScrollMouseDown('right')}
                    onMouseUp={() => handleScrollMouseUp('right')}
                    onMouseLeave={stopScroll}
                    data-testid="chat-scroll-right-button"
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 select-none"
                >
                    ›
                </button>
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 min-w-0 overflow-y-auto flex flex-col gap-2"
            >
                {messagesLoading && messages.length === 0 && (
                    <div data-testid="chat-messages-skeleton" className="flex flex-col gap-3 animate-pulse">
                        <div className="flex gap-2.5 max-w-md mr-auto">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-gray-300" />
                            <div className="flex flex-col gap-1">
                                <div className="h-8 w-40 bg-gray-200 rounded-2xl" />
                                <div className="h-8 w-28 bg-gray-200 rounded-2xl" />
                            </div>
                        </div>
                        <div className="flex gap-2.5 max-w-md ml-auto flex-row-reverse">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-gray-300" />
                            <div className="flex flex-col gap-1 items-end">
                                <div className="h-8 w-32 bg-blue-100 rounded-2xl" />
                            </div>
                        </div>
                    </div>
                )}
                {!hideEmptyNotice && !currentRoomId && messages.length === 0 && recipientId !== aiUserId && (
                    <EmptyStateNotice
                        text="위를 클릭하여 대화하세요."
                        colorClass="text-green-700 bg-green-50"
                        testId="chat-empty-placeholder"
                        onDismiss={dismissEmptyNotice}
                    />
                )}
                {recipientId === aiUserId && !currentRoomId && messages.length === 0 && !showPersonalitySelector && (
                    <EmptyStateNotice
                        text={pendingPersonality ? '성격 설정 완료! 메시지를 보내보세요.' : 'AI와의 대화도 시작해 보세요!'}
                        colorClass="text-amber-800 bg-amber-50"
                        testId="chat-ai-empty-placeholder"
                    />
                )}
                {messages.reduce<Message[][]>((groups, msg) => {
                    const lastGroup = groups[groups.length - 1];
                    if (lastGroup && lastGroup[0].userId === msg.userId) {
                        lastGroup.push(msg);
                    } else {
                        groups.push([msg]);
                    }
                    return groups;
                }, []).map((group, gi) => {
                    const isMine = group[0].userId === userId;
                    const isAi = aiUserId !== null && group[0].userId === aiUserId;
                    const profileImage = isAi ? null : profileImageById.get(group[0].userId);
                    return (
                        <div
                            key={group[0].id ?? gi}
                            className={`flex gap-2.5 max-w-md ${isMine ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                        >
                            {profileImage ? (
                                <img
                                    src={profileImage}
                                    alt={displayName(group[0].userId)}
                                    className="shrink-0 w-7 h-7 rounded-full object-cover self-end"
                                />
                            ) : (
                                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center self-end text-xs font-semibold text-white ${isAi ? 'bg-purple-500' : 'bg-gray-400'}`}>
                                    {initials(group[0].userId)}
                                </div>
                            )}
                            <div className={`flex flex-col gap-0.5 min-w-0 ${isMine ? 'items-end' : 'items-start'}`}>
                                {group.map((msg, i) => {
                                    const isLast = i === group.length - 1;
                                    return (
                                        <div key={msg.id ?? i} className={`flex flex-col min-w-0 ${isMine ? 'items-end' : 'items-start'}`}>
                                            <div
                                                className={`relative p-2 rounded-2xl wrap-break-word max-w-[70vw] ${isMine ? 'bg-blue-100' : 'bg-gray-100'} ${isLast ? bubbleTailClass(isMine) : ''}`}
                                                dangerouslySetInnerHTML={{ __html: DOMpurify.sanitize(msg.message) }}
                                            />
                                            {msg.createdAt && (
                                                <span className="text-xs text-gray-400 mt-0.5">{formatTime(msg.createdAt)}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
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
        {rateLimitSecondsLeft !== null && (
            <RateLimitNotice secondsLeft={rateLimitSecondsLeft} />
        )}
        <div className="flex gap-2 mt-4 items-end">
                <textarea
                    ref={messageInputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    data-testid="chat-message-input"
                    rows={1}
                    className="flex-1 resize-none border border-gray-300 px-4 py-2 rounded-2xl max-h-32 overflow-y-auto scrollbar-none transition-[height] duration-250 ease-out focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
                    style={{ fontFamily: "'Cormorant Garamond', 'Hahmlet', serif" }}
                    placeholder="채팅하세요!"
                />
                <button
                    onClick={sendMessage}
                    disabled={rateLimitSecondsLeft !== null}
                    data-testid="chat-send-button"
                    aria-label="Send"
                    className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                        rateLimitSecondsLeft !== null
                            ? 'bg-sky-200 text-sky-600 cursor-not-allowed'
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.21L4.5 12 2 18.79a1 1 0 0 0 1.4 1.21z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default ChatPage;
