import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth.store";
import { socket } from "../socket/socket";

interface Message {
    userId: number,
    message: string,
    roomId: number,
};

function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const { accessToken } = useAuthStore();

    useEffect(() => {
        socket.on('receiveMessage', (message: Message) => {
            setMessages((prev) => [...prev, message])
        })

        return () => {
            socket.off('receiveMessage')
            socket.disconnect()
        }
    }, [accessToken]);

    const sendMessage = () => {
        if (!input.trim())
            return socket.emit('sendMessage', { message: input, roomId: 1 })
        setInput('');
    };

    return (
        <div className="flex flex-column h-screen p-4">
            <div className="flex-1 overflow-y-auto flex flex-column gap-2">
                {messages.map((msg, i) => (
                    <div key={i} className="bg-gray-100 p-2 rounded">
                        {msg.message}
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