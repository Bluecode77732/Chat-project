import { useQuery, useMutation } from '@apollo/client/react';
import { GET_ALL_ROOMS, DELETE_ROOM } from '../api/graphql-operations';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import api from '../api/axios';

interface Room {
    roomId: number;
    participantIds: number[];
}

function RoomsPage() {
    const { data, loading, refetch } = useQuery<{ getAllRooms: Room[] }>(GET_ALL_ROOMS);
    const [deleteRoom] = useMutation<boolean, { roomId: number }>(DELETE_ROOM);
    const [actionMsg, setActionMsg] = useState('');
    const navigate = useNavigate();
    const clearTokens = useAuthStore((s) => s.clearTokens);

    const handleDelete = async (roomId: number) => {
        if (!confirm(`Delete room ${roomId}? All messages will be lost.`)) return;
        try {
            await deleteRoom({ variables: { roomId } });
            setActionMsg(`Room ${roomId} deleted.`);
            await refetch();
        } catch {
            setActionMsg(`Failed to delete room ${roomId}.`);
        }
    };

    const signOut = async () => {
        try {
            await api.delete('/auth/signout');
        } catch {
            // best effort
        } finally {
            clearTokens();
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Rooms</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/users')}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Users
                        </button>
                        <button
                            onClick={signOut}
                            className="text-sm text-red-600 hover:underline"
                        >
                            Sign out
                        </button>
                    </div>
                </div>

                {actionMsg && (
                    <p className="mb-4 text-sm text-blue-700 bg-blue-50 rounded px-3 py-2">{actionMsg}</p>
                )}

                {loading ? (
                    <p className="text-gray-500">Loading...</p>
                ) : (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-left">
                                <tr>
                                    <th className="px-4 py-3">Room ID</th>
                                    <th className="px-4 py-3">Participants</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.getAllRooms.map((room: Room) => (
                                    <tr key={room.roomId} className="border-t">
                                        <td className="px-4 py-3">{room.roomId}</td>
                                        <td className="px-4 py-3">{room.participantIds.join(', ')}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleDelete(room.roomId)}
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
                )}
            </div>
        </div>
    );
}

export default RoomsPage;
