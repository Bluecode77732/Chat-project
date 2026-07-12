import { useQuery, useMutation } from '@apollo/client/react';
import { GET_ALL_ROOMS, DELETE_ROOM, GET_USER_NICKNAMES, SET_ADMIN_AI_PERSONALITY } from '../api/graphql-operations';
import { useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import api from '../api/axios';

// AI_PERSONALITIES: ordered list of valid enum values for the personality dropdown.
// Must match AiPersonality enum in backend/src/ai/enums/ai-personality.enum.ts.
const AI_PERSONALITIES = ['FRIENDLY', 'CODING', 'ENGLISH', 'CREATIVE'] as const;
type AiPersonality = typeof AI_PERSONALITIES[number];

const PERSONALITY_LABEL: Record<AiPersonality, string> = {
    FRIENDLY: '친절한 어시스턴트',
    CODING: '코드 도우미',
    ENGLISH: '영어 선생님',
    CREATIVE: '창의적인 작가',
};

const PERSONALITY_COLOR: Record<AiPersonality, string> = {
    FRIENDLY: 'bg-green-100 text-green-700',
    CODING: 'bg-indigo-100 text-indigo-700',
    ENGLISH: 'bg-yellow-100 text-yellow-700',
    CREATIVE: 'bg-purple-100 text-purple-700',
};

interface Room {
    roomId: number;
    participantIds: number[];
    created: string;
    aiPersonality?: AiPersonality | null;
}

interface PaginatedRooms {
    data: Room[];
    total: number;
    page: number;
    take: number;
}

function RoomsPage() {
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState<'DESC' | 'ASC'>('DESC');
    const [sortBy, setSortBy] = useState<'id' | 'created'>('id');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { data, loading, refetch } = useQuery<{ getAllRooms: PaginatedRooms }>(GET_ALL_ROOMS, {
        variables: { page, take: 20, sort, sortBy, search: debouncedSearch || undefined },
    });
    const { data: nicknamesData } = useQuery<{ getUserNicknames: Array<{ id: string; nickname: string | null }> }>(GET_USER_NICKNAMES, {
        pollInterval: 60000,
    });
    const nicknameById = new Map(
        nicknamesData?.getUserNicknames.map((u) => [Number(u.id), u.nickname]) ?? []
    );
    const displayName = (id: number) => nicknameById.get(id) || `User ${id}`;
    const [deleteRoom] = useMutation<boolean, { roomId: number }>(DELETE_ROOM);
    const [setPersonality] = useMutation<boolean, { roomId: number; personality: string }>(SET_ADMIN_AI_PERSONALITY);
    const [actionMsg, setActionMsg] = useState('');
    const navigate = useNavigate();
    const clearTokens = useAuthStore((s) => s.clearTokens);

    const result = data?.getAllRooms;
    const rooms = result?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.take ?? 20)));

    const toggleSort = (field: 'id' | 'created') => {
        if (sortBy === field) {
            setSort((s) => (s === 'DESC' ? 'ASC' : 'DESC'));
        } else {
            setSortBy(field);
            setSort('DESC');
        }
        setPage(1);
    };

    const changePage = (next: number) => setPage(next);

    const handleSearch = (value: string) => {
        setSearch(value);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setDebouncedSearch(value);
            setPage(1);
        }, 300);
    };

    const handleDelete = async (roomId: number) => {
        if (!confirm(`Delete room ${roomId}? All messages will be lost.`)) return;
        try {
            await deleteRoom({ variables: { roomId } });
            setActionMsg(`Room ${roomId} deleted.`);
            await refetch({ page, take: 20, sort, sortBy, search: debouncedSearch || undefined });
        } catch {
            setActionMsg(`Failed to delete room ${roomId}.`);
        }
    };

    // handlePersonalityChange: admin sets AI personality for any room without being a participant.
    // Uses setAdminAiPersonality mutation which bypasses the participant check.
    const handlePersonalityChange = async (roomId: number, personality: string) => {
        if (!personality) return;
        try {
            await setPersonality({ variables: { roomId, personality } });
            setActionMsg(`Room ${roomId} AI set to ${personality}.`);
            await refetch({ page, take: 20, sort, sortBy, search: debouncedSearch || undefined });
        } catch {
            setActionMsg(`Failed to set AI personality for room ${roomId}.`);
        }
    };

    const signOut = async () => {
        try {
            await api.post('/auth/signOut');
        } catch {
            // best effort
        } finally {
            clearTokens();
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Rooms</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            data-testid="nav-dashboard"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigate('/users')}
                            data-testid="nav-users"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Users
                        </button>
                        <button
                            onClick={() => navigate('/logs')}
                            data-testid="nav-logs"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Logs
                        </button>
                        <button
                            onClick={signOut}
                            data-testid="sign-out-button"
                            className="text-sm text-red-600 hover:underline"
                        >
                            Sign out
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Search by participant email or nickname..."
                        data-testid="room-search-input"
                        className="w-full text-sm border rounded px-3 py-2"
                    />
                </div>

                {actionMsg && (
                    <p data-testid="action-message" className="mb-4 text-sm text-blue-700 bg-blue-50 rounded px-3 py-2">{actionMsg}</p>
                )}

                {loading ? (
                    <p className="text-gray-500">Loading...</p>
                ) : (
                    <>
                        <div className="bg-white rounded-xl shadow overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 text-left">
                                    <tr>
                                        <th className="px-4 py-3">
                                            <button onClick={() => toggleSort('id')} className={`hover:underline cursor-pointer${sortBy === 'id' ? ' font-bold' : ''}`}>
                                                Room ID
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">Participants</th>
                                        <th className="px-4 py-3">
                                            <button onClick={() => toggleSort('created')} className={`hover:underline cursor-pointer${sortBy === 'created' ? ' font-bold' : ''}`}>
                                                Created
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">AI Personality</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rooms.map((room: Room) => (
                                        <tr key={room.roomId} data-testid={`room-row-${room.roomId}`} className="border-t">
                                            <td className="px-4 py-3">{room.roomId}</td>
                                            <td className="px-4 py-3">{room.participantIds.map(displayName).join(', ')}</td>
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                {new Date(room.created).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {room.aiPersonality ? (
                                                        <span
                                                            data-testid={`room-ai-badge-${room.roomId}`}
                                                            className={`px-2 py-0.5 rounded text-xs font-medium ${PERSONALITY_COLOR[room.aiPersonality]}`}
                                                        >
                                                            {PERSONALITY_LABEL[room.aiPersonality]}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">None</span>
                                                    )}
                                                    {/* Dropdown: lets admin set or change AI personality for any room. */}
                                                    <select
                                                        value={room.aiPersonality ?? ''}
                                                        onChange={(e) => handlePersonalityChange(room.roomId, e.target.value)}
                                                        data-testid={`room-ai-select-${room.roomId}`}
                                                        className="text-xs border rounded px-1 py-0.5 text-gray-600"
                                                        aria-label={`AI personality for room ${room.roomId}`}
                                                    >
                                                        <option value="">— set —</option>
                                                        {AI_PERSONALITIES.map((p) => (
                                                            <option key={p} value={p}>{p}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleDelete(room.roomId)}
                                                    data-testid={`room-delete-${room.roomId}`}
                                                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                            <span>Page {result?.page ?? 1} of {totalPages} ({result?.total ?? 0} total)</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => changePage(Math.max(1, page - 1))}
                                    disabled={page <= 1}
                                    className="px-3 py-1 rounded border disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <button
                                    onClick={() => changePage(Math.min(totalPages, page + 1))}
                                    disabled={page >= totalPages}
                                    className="px-3 py-1 rounded border disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default RoomsPage;
