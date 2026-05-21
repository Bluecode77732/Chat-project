import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth.store";
import { reconnectSocket, socket } from "../socket/socket";
import DOMpurify from 'dompurify';
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useSubscription } from "@apollo/client/react";
import { SEND_MESSAGE, RECEIVE_MESSAGE, GET_ONLINE_USERS } from "../api/graphql-operations";

interface Message {
    userId: number,
    message: string,
    roomId: number,
};

// GraphQL explicit return type 
interface SubscriptionData {
    receiveMessage: {
        id: number,
        message: string,
        participant: {
            id: number
        },
    };
};

interface SendMessageData {
    sendMessage: {
        id: number;
        message: string;
        participant: { id: number };
        roomId: number;
    };
}

// Adding user online status banner
interface OnlineUsersData {
  getOnlineUser: number[]
}


function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [recipientId, setRecipientId] = useState<number | null>(null)
    const [currentRoomId, setCurrentRoomId] = useState<number | null>(null)
    const { clearTokens } = useAuthStore();
    const { accessToken, userId } = useAuthStore();
    const navigate = useNavigate();

    // GraphQL Set Up
    const [sendMessageMutation] = useMutation<SendMessageData>(SEND_MESSAGE);
    const { data: subData } = useSubscription<SubscriptionData>(RECEIVE_MESSAGE, {
        variables: { roomId: currentRoomId },
        skip: !currentRoomId,
    });

    // Adding user online status banner
    const { data: onlineData } = useQuery<OnlineUsersData>(GET_ONLINE_USERS, {
        pollInterval: 5000,
    });

    useEffect(() => {
        if (subData?.receiveMessage) {
            const senderId = Number(subData.receiveMessage.participant?.id);
            if (senderId !== userId) {
                setMessages((prev) => [...prev, {
                    userId: senderId,
                    message: subData.receiveMessage.message,
                    roomId: currentRoomId!,
                }]);
            }
        };
    }, [subData]);

    useEffect(() => {
        // Recreates 'Socket' and reconnects with renewed token to assure connection 'accessToken' remaining status after sign in.
        reconnectSocket();

        socket.on('CreateRoom', (roomId: string) => {
            setCurrentRoomId(Number(roomId));
        });

        // Throws error case
        socket.on('connect_error', (err) => {
            console.error('Socket has failed to connect: ', err.message);
        });

        // Prevents memory leak and duplicated events
        return () => {
            socket.off('CreateRoom');
            socket.off('connect_error');
            socket.disconnect();
        };
        // Restarts when 'accessToken' changes
    }, [accessToken]);

    const sendMessage = async () => {
        // Prevents blank messages
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

        setMessages((prev) => [...prev, {
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
            <div className="flex gap-2 mb-4">
                {onlineData?.getOnlineUser?.map((id: number) => (
                    <span
                        key={id}
                        onClick={() => setRecipientId(id)}
                        className={`px-3 py-1 rounded-full text-sm cursor-pointer ${id === userId ? 'bg-green-200' : 'bg-gray-200 hover:bg-blue-100'}`}
                    >
                        {id === userId ? `Me (${id})` : `User ${id}`}
                    </span>
                ))}
            </div>
            <div className="flex gap-2 mb-4">
                <input
                    type="number"
                    value={recipientId ?? ''}
                    onChange={(e) => setRecipientId(Number(e.target.value))}
                    className="border p-2 rounded w-40"
                    placeholder="Recipient ID"
                >
                </input>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`p-2 rounded max-w-xs ${msg.userId === userId
                            ? 'bg-blue-100 ml-auto'
                            : 'bg-gray-100 mr-auto'
                            }`}
                        dangerouslySetInnerHTML={{
                            // Message XSS Vulnerability can be rendered after `sanitize`.
                            __html: DOMpurify.sanitize(msg.message),
                        }}>
                    </div>
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
    )
}

export default ChatPage