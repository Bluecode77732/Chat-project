import { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client/react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { GET_USER_NICKNAMES } from '../api/graphql-operations';

interface AuditLog {
    id: number;
    actorId: number;
    targetId: number | null;
    action: string;
    detail: string | null;
    created: string;
}

interface AuditLogPage {
    data: AuditLog[];
    total: number;
    page: number;
    take: number;
}

const ACTIONS = ['ROLE_CHANGE', 'FORCE_LOGOUT', 'USER_DELETE'];

function LogsPage() {
    const [result, setResult] = useState<AuditLogPage>({ data: [], total: 0, page: 1, take: 20 });
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState('');
    const [page, setPage] = useState(1);
    const navigate = useNavigate();
    const clearTokens = useAuthStore((s) => s.clearTokens);
    const { data: nicknamesData } = useQuery<{ getUserNicknames: Array<{ id: string; nickname: string | null }> }>(GET_USER_NICKNAMES, {
        pollInterval: 60000,
    });
    const nicknameById = new Map(
        nicknamesData?.getUserNicknames.map((u) => [Number(u.id), u.nickname]) ?? []
    );
    const displayName = (id: number) => nicknameById.get(id) || `User ${id}`;

    useEffect(() => {
        api.get('/audit-log', { params: { action: action || undefined, page } })
            .then((res) => setResult(res.data as AuditLogPage))
            .finally(() => setLoading(false));
    }, [action, page]);

    const changeAction = (value: string) => {
        setLoading(true);
        setAction(value);
        setPage(1);
    };

    const changePage = (newPage: number) => {
        setLoading(true);
        setPage(newPage);
    };

    const signOut = async () => {
        try { await api.post('/auth/signOut'); } catch { /* best effort */ }
        clearTokens();
        navigate('/');
    };

    const actionColor = (action: string) => {
        if (action === 'ROLE_CHANGE') return 'bg-indigo-100 text-indigo-700';
        if (action === 'FORCE_LOGOUT') return 'bg-yellow-100 text-yellow-700';
        if (action === 'USER_DELETE') return 'bg-red-100 text-red-700';
        return 'bg-gray-100 text-gray-600';
    };

    const totalPages = Math.max(1, Math.ceil(result.total / result.take));

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Audit Logs</h1>
                    <div className="flex gap-3">
                        <button onClick={() => navigate('/users')} className="text-sm text-blue-600 hover:underline">Users</button>
                        <button onClick={() => navigate('/rooms')} className="text-sm text-blue-600 hover:underline">Rooms</button>
                        <button onClick={signOut} className="text-sm text-red-600 hover:underline">Sign out</button>
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <label className="text-sm text-gray-600">Action</label>
                    <select
                        value={action}
                        onChange={(e) => changeAction(e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                    >
                        <option value="">All</option>
                        {ACTIONS.map((a) => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <p className="text-gray-500">Loading...</p>
                ) : (
                    <>
                        <div className="bg-white rounded-xl shadow overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 text-left">
                                    <tr>
                                        <th className="px-4 py-3">Time</th>
                                        <th className="px-4 py-3">Action</th>
                                        <th className="px-4 py-3">Actor</th>
                                        <th className="px-4 py-3">Target</th>
                                        <th className="px-4 py-3">Detail</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.data.map((log) => (
                                        <tr key={log.id} className="border-t">
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                {new Date(log.created).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">{displayName(log.actorId)}</td>
                                            <td className="px-4 py-3">{log.targetId !== null ? displayName(log.targetId) : '—'}</td>
                                            <td className="px-4 py-3 text-gray-500">{log.detail ?? '—'}</td>
                                        </tr>
                                    ))}
                                    {result.data.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No logs yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                            <span>Page {result.page} of {totalPages} ({result.total} total)</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => changePage(Math.max(1, result.page - 1))}
                                    disabled={result.page <= 1}
                                    className="px-3 py-1 rounded border disabled:opacity-40"
                                >
                                    Prev
                                </button>
                                <button
                                    onClick={() => changePage(Math.min(totalPages, result.page + 1))}
                                    disabled={result.page >= totalPages}
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

export default LogsPage;
