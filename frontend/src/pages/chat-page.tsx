import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth.store";
import { reconnectSocket, socket } from "../socket/socket";
import DOMpurify from 'dompurify';

interface Message {
    userId: number,
    message: string,
    roomId: number,
};

function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [recipientId, setRecipientId] = useState<number | null>(null)
    const { accessToken, userId } = useAuthStore();

    useEffect(() => {
        // Recreates 'Socket' and reconnects with renewed token to assure connection 'accessToken' remaining status after sign in.
        reconnectSocket();

        // Perceives messages sent in real-time
        socket.on('receiveMessage', (message: Message) => {
            // Messages add with previous messages
            setMessages((prev) => [...prev, message]);
        });

        // Throws error case
        socket.on('connect_error', (err) => {
            console.error('Socket has failed to connect: ', err.message);
        });

        // Prevents memory leak and duplicated events
        return () => {
            socket.off('receiveMessage');
            socket.off('connect_error');
            socket.disconnect();
        }
        // Restarts when 'accessToken' changes
    }, [accessToken]);

    const sendMessage = () => {
        // Prevents blank messages
        if (!input.trim() || !recipientId)
            // Messages send to the chat gateway `@SubscribeMessage('sendMessage')`.
            return socket.emit('sendMessage', { message: input, recipientId });
        setInput('');
    };

    return (
        <div className="flex flex-col h-screen p-4">
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