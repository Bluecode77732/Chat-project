import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface User {
    id: number;
    email: string;
    nickname: string | null;
    role: number;
}

function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [actionMsg, setActionMsg] = useState('');
    const navigate = useNavigate();
    const myRole = useAuthStore((s) => s.role);
    const clearTokens = useAuthStore((s) => s.clearTokens);

    useEffect(() => {
        api.get('/user')
            .then((res) => setUsers(res.data as User[]))
            .catch(() => setActionMsg('Failed to load users.'))
            .finally(() => setLoading(false));
    }, [refreshKey]);

    const refresh = () => {
        setLoading(true);
        setRefreshKey((k) => k + 1);
    };

    const updateRole = async (id: number, role: number) => {
        try {
            await api.patch(`/user/${id}/role`, { role });
            setActionMsg(`User ${id} role updated to ${role === 1 ? 'admin' : 'user'}.`);
            refresh();
        } catch {
            setActionMsg(`Failed to update role for user ${id}.`);
        }
    };

    const forceLogout = async (id: number) => {
        try {
            await api.post(`/user/${id}/force-logout`);
            setActionMsg(`User ${id} force-logged out.`);
        } catch {
            setActionMsg(`Failed to force logout user ${id}.`);
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm(`Delete user ${id}? This is irreversible.`)) return;
        try {
            await api.delete(`/user/${id}`);
            setActionMsg(`User ${id} deleted.`);
            refresh();
        } catch {
            setActionMsg(`Failed to delete user ${id}.`);
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
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Users</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/rooms')}
                            data-testid="nav-rooms"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            Rooms
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

                {actionMsg && (
                    <p data-testid="action-message" className="mb-4 text-sm text-blue-700 bg-blue-50 rounded px-3 py-2">{actionMsg}</p>
                )}

                {loading ? (
                    <p className="text-gray-500">Loading...</p>
                ) : (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-left">
                                <tr>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Nickname</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} data-testid={`user-row-${u.id}`} className="border-t">
                                        <td className="px-4 py-3">{u.id}</td>
                                        <td className="px-4 py-3">{u.nickname ?? '—'}</td>
                                        <td className="px-4 py-3">{u.email}</td>
                                        <td className="px-4 py-3">
                                            <span data-testid={`user-role-${u.id}`} className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                u.role === 2 ? 'bg-red-100 text-red-700' :
                                                u.role === 1 ? 'bg-purple-100 text-purple-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                                {u.role === 2 ? 'superadmin' : u.role === 1 ? 'admin' : 'user'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 flex gap-2 flex-wrap">
                                            {myRole === 2 && u.role !== 2 && (
                                                <button
                                                    onClick={() => updateRole(u.id, u.role === 1 ? 0 : 1)}
                                                    data-testid={`user-promote-${u.id}`}
                                                    className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                                >
                                                    {u.role === 1 ? 'Demote' : 'Promote'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => forceLogout(u.id)}
                                                data-testid={`user-force-logout-${u.id}`}
                                                className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                            >
                                                Force logout
                                            </button>
                                            <button
                                                onClick={() => deleteUser(u.id)}
                                                data-testid={`user-delete-${u.id}`}
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

export default UsersPage;
