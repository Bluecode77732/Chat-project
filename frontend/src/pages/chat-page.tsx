import { useState } from "react";
import { useAuthStore } from "../store/auth.store";

interface Message {
    userId: number,
    message: string,
    roomId: number,
};

function ChatPage() {
    const [message, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const { accessToken } = useAuthStore;

    
}