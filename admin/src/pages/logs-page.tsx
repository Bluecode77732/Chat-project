import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface AuditLog {
    id: number;
    actorId: number;
    targetId: number | null;
    action: string;
    detail: string | null;
    created: string;
}

function LogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const clearTokens = useAuthStore((s) => s.clearTokens);

    useEffect(() => {
        api.get('/audit-log')
            .then((res) => setLogs(res.data as AuditLog[]))
            .finally(() => setLoading(false));
    }, []);

    const signOut = async () => {
        try { await api.delete('/auth/signout'); } catch { /* best effort */ }
        clearTokens();
        navigate('/');
    };

    const actionColor = (action: string) => {
        if (action === 'ROLE_CHANGE') return 'bg-indigo-100 text-indigo-700';
        if (action === 'FORCE_LOGOUT') return 'bg-yellow-100 text-yellow-700';
        if (action === 'USER_DELETE') return 'bg-red-100 text-red-700';
        return 'bg-gray-100 text-gray-600';
    };

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

                {loading ? (
                    <p className="text-gray-500">Loading...</p>
                ) : (
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
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-t">
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(log.created).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{log.actorId}</td>
                                        <td className="px-4 py-3">{log.targetId ?? '—'}</td>
                                        <td className="px-4 py-3 text-gray-500">{log.detail ?? '—'}</td>
                                    </tr>
                                ))}
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-gray-400">No logs yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LogsPage;
