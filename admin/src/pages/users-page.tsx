import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { AUDIT_ACTION_LABEL } from '../constants/audit-action-label';

interface User {
    id: number;
    email: string;
    nickname: string | null;
    role: number;
    created: string;
}

interface UserPage {
    data: User[];
    total: number;
    page: number;
    take: number;
}

// GET /user/:id 응답 중 목록 응답에는 없는 필드.
// status/bannedUntil은 moderation 레이어에서 옴; password는 interceptor가 @Excluded 처리.
interface UserDetail {
    status?: string;
    bannedUntil?: string | null;
}

interface AuditLogEntry {
    id: number;
    action: string;
    actorId: number;
    targetId: number | null;
    detail: string | null;
    created: string;
}

const ROLE_LABEL: Record<number, string> = { 0: '일반', 1: '관리자', 2: '최고 관리자' };
const ROLE_COLOR: Record<number, string> = {
    0: 'bg-gray-100 text-gray-600',
    1: 'bg-purple-100 text-purple-700',
    2: 'bg-red-100 text-red-700',
};
const ACTION_COLOR: Record<string, string> = {
    ROLE_CHANGE: 'bg-indigo-100 text-indigo-700',
    FORCE_LOGOUT: 'bg-yellow-100 text-yellow-700',
    USER_DELETE: 'bg-red-100 text-red-700',
    USER_UNBAN: 'bg-green-100 text-green-700',
    USER_MUTED: 'bg-orange-100 text-orange-700',
    USER_BANNED: 'bg-rose-100 text-rose-700',
};

function UsersPage() {
    const [result, setResult] = useState<UserPage>({ data: [], total: 0, page: 1, take: 20 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState<'DESC' | 'ASC'>('DESC');
    const [sortBy, setSortBy] = useState<'id' | 'role' | 'created'>('id');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'banned'>('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [actionMsg, setActionMsg] = useState('');

    // selectedUser: 상세 패널을 열기 위해 클릭된 행.
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    // panelDetail: GET /user/:id로 가져오는, 목록 응답엔 없는 필드(status, bannedUntil).
    // fetch 진행 중엔 null; 완료되면(성공/실패 무관) {} (빈 객체).
    const [panelDetail, setPanelDetail] = useState<UserDetail | null>(null);
    // panelLogs: 선택된 사용자와 관련된 최근 5개의 audit log 항목.
    const [panelLogs, setPanelLogs] = useState<AuditLogEntry[]>([]);
    // panelRefreshKey: 증가시키면 selectedUser 변경 없이 panel fetch를 재실행.
    // unban()이 ban 해제 후 moderation 상태를 다시 불러올 때 사용.
    const [panelRefreshKey, setPanelRefreshKey] = useState(0);
    // 파생값 — effect 본문 안에서의 동기 setState를 피함.
    const panelLoading = selectedUser !== null && panelDetail === null;

    const navigate = useNavigate();
    const myRole = useAuthStore((s) => s.role);
    const myUserId = useAuthStore((s) => s.userId);
    const clearTokens = useAuthStore((s) => s.clearTokens);

    // setLoading(true)를 이 effect 본문에 두지 않는 건 의도적 — react-hooks/set-state-in-effect 규칙 때문.
    // 각 트리거(changePage, toggleSort, handleSearch debounce, refresh)가 dependency를
    // 갱신하기 전에 자신의 이벤트 핸들러나 타이머 콜백에서 loading=true를 설정.
    useEffect(() => {
        let cancelled = false;
        api.get('/user', { params: { page, take: 20, sort, sortBy, search: debouncedSearch || undefined, status: statusFilter || undefined } })
            .then((res) => { if (!cancelled) { setResult(res.data as UserPage); setLoading(false); } })
            .catch(() => { if (!cancelled) { setActionMsg('사용자 목록을 불러오지 못했습니다.'); setLoading(false); } });
        return () => { cancelled = true; };
    }, [page, sort, sortBy, debouncedSearch, statusFilter, refreshKey]);

    // 사용자 행 선택 시 또는 panelRefreshKey 변경 시(예: unban 후) panel 데이터를 fetch.
    // moderation 상태는 GET /user/:id, 최근 로그는 GET /audit-log?userId.
    // 모든 setState 호출은 async 콜백 안에 있음 — react-hooks/set-state-in-effect 회피.
    useEffect(() => {
        if (!selectedUser) return;
        let cancelled = false;
        Promise.all([
            api.get(`/user/${selectedUser.id}`),
            api.get('/audit-log', { params: { userId: selectedUser.id, take: 5, sort: 'DESC' } }),
        ])
            .then(([detailRes, logsRes]) => {
                if (cancelled) return;
                setPanelDetail(detailRes.data as UserDetail);
                setPanelLogs((logsRes.data as { data: AuditLogEntry[] }).data);
            })
            .catch(() => {
                // panel은 부가 정보 — panelLoading이 풀리도록 done 상태(non-null)로 표시.
                if (!cancelled) setPanelDetail({});
            });
        return () => { cancelled = true; };
    // panelRefreshKey는 의도적: unban()이 이를 증가시켜 selectedUser 변경 없이
    // moderation 상태를 다시 불러옴 — panel이 제자리에서 re-fetch됨.
    }, [selectedUser, panelRefreshKey]);

    const refresh = () => { setLoading(true); setRefreshKey((k) => k + 1); };

    const changeStatusFilter = (value: '' | 'active' | 'banned') => {
        setLoading(true);
        setStatusFilter(value);
        setPage(1);
    };

    // openPanel: panel 데이터를 effect가 아닌 이벤트 핸들러에서 리셋 — useEffect 본문은
    // async 콜백에서만 setState를 호출하도록 해서 react-hooks/set-state-in-effect 충족.
    const openPanel = (u: User) => {
        setSelectedUser(u);
        setPanelDetail(null);
        setPanelLogs([]);
    };

    const handleSearch = (value: string) => {
        setSearch(value);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setLoading(true);  // 타이머 콜백 — useEffect 본문 안이 아님
            setDebouncedSearch(value);
            setPage(1);
        }, 300);
    };

    const toggleSort = (field: 'id' | 'role' | 'created') => {
        setLoading(true);  // 이벤트 핸들러 — useEffect 본문 안이 아님
        if (sortBy === field) {
            setSort((s) => (s === 'DESC' ? 'ASC' : 'DESC'));
        } else {
            setSortBy(field);
            setSort('DESC');
        }
        setPage(1);
    };

    const changePage = (next: number) => {
        setLoading(true);  // 이벤트 핸들러 — useEffect 본문 안이 아님
        setPage(next);
    };

    const totalPages = Math.max(1, Math.ceil(result.total / result.take));
    const users = result.data;

    const updateRole = async (id: number, role: number) => {
        try {
            await api.patch(`/user/${id}/role`, { role });
            setActionMsg(`사용자 ${id}번의 역할을 변경했습니다. (${role === 1 ? '관리자' : '일반'})`);
            refresh();
        } catch {
            setActionMsg(`사용자 ${id}번의 역할 변경에 실패했습니다.`);
        }
    };

    // unban: POST /user/:id/unban으로 ban/mute/strike를 해제.
    // panel 데이터를 (effect가 아닌) 핸들러에서 리셋하고 panelRefreshKey를 증가시켜
    // panel fetch를 재실행 — panel을 닫지 않고 갱신된 상태를 보여줌.
    const unban = async (userId: number) => {
        try {
            await api.post(`/user/${userId}/unban`);
            setActionMsg(`사용자 ${userId}번의 차단을 해제했습니다.`);
            setPanelDetail(null);
            setPanelLogs([]);
            setPanelRefreshKey((k) => k + 1);
        } catch {
            setActionMsg(`사용자 ${userId}번의 차단 해제에 실패했습니다.`);
        }
    };

    // ban: 자동 strike 시스템과 별개로, POST /user/:id/ban을 통한 수동 admin ban.
    // 선택적 사유를 prompt로 받음; Cancel은 전체 취소(null), 빈 입력으로 OK해도 ban은 진행.
    const ban = async (userId: number) => {
        const reason = prompt('차단 사유 (선택):');
        if (reason === null) return;
        try {
            await api.post(`/user/${userId}/ban`, reason ? { reason } : {});
            setActionMsg(`사용자 ${userId}번을 차단했습니다.`);
            setPanelDetail(null);
            setPanelLogs([]);
            setPanelRefreshKey((k) => k + 1);
        } catch {
            setActionMsg(`사용자 ${userId}번 차단에 실패했습니다.`);
        }
    };

    // demoteSuperadmin: 동료 superadmin을 admin으로 강등. 계정 탈취 봉쇄 목적의 별도 액션이라
    // 일반 promote/demote 토글과 분리 — 백엔드 updateRole은 동일-역할 대상을 막지 않으므로
    // (다른 조치들과 달리) 여기서만 UI 차원의 확인창을 둠. 마지막 superadmin 강등은 서버가 거부함.
    const demoteSuperadmin = async (id: number) => {
        if (!confirm(`최고 관리자 ${id}번을 관리자로 강등할까요? 침해된 계정을 격리할 때만 사용하세요.`)) return;
        await updateRole(id, 1);
    };

    const forceLogout = async (id: number) => {
        try {
            await api.post(`/user/${id}/force-logout`);
            setActionMsg(`사용자 ${id}번을 강제 로그아웃했습니다.`);
        } catch {
            setActionMsg(`사용자 ${id}번 강제 로그아웃에 실패했습니다.`);
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm(`사용자 ${id}번을 삭제할까요? 되돌릴 수 없습니다.`)) return;
        try {
            await api.delete(`/user/${id}`);
            setActionMsg(`사용자 ${id}번을 삭제했습니다.`);
            refresh();
            setSelectedUser(null);
        } catch {
            setActionMsg(`사용자 ${id}번 삭제에 실패했습니다.`);
        }
    };

    const signOut = async () => {
        try {
            await api.post('/auth/signOut');
        } catch {
            // best effort — 실패해도 무시
        } finally {
            clearTokens();
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">사용자</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            data-testid="nav-dashboard"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            대시보드
                        </button>
                        <button
                            onClick={() => navigate('/rooms')}
                            data-testid="nav-rooms"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            채팅방
                        </button>
                        <button
                            onClick={() => navigate('/logs')}
                            data-testid="nav-logs"
                            className="text-sm text-blue-600 hover:underline"
                        >
                            로그
                        </button>
                        <button
                            onClick={signOut}
                            data-testid="sign-out-button"
                            className="text-sm text-red-600 hover:underline"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="이메일 또는 닉네임으로 검색..."
                        data-testid="user-search-input"
                        className="flex-1 text-sm border rounded px-3 py-2"
                    />
                    <label className="text-sm text-gray-600 whitespace-nowrap">상태</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => changeStatusFilter(e.target.value as '' | 'active' | 'banned')}
                        data-testid="user-status-filter"
                        className="text-sm border rounded px-2 py-2"
                    >
                        <option value="">전체</option>
                        <option value="active">정상</option>
                        <option value="banned">차단됨</option>
                    </select>
                </div>

                {actionMsg && (
                    <p data-testid="action-message" className="mb-4 text-sm text-blue-700 bg-blue-50 rounded px-3 py-2">{actionMsg}</p>
                )}

                {loading ? (
                    <p className="text-gray-500">불러오는 중...</p>
                ) : (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-left">
                                <tr>
                                    <th className="px-4 py-3">
                                        <button onClick={() => toggleSort('id')} className={`hover:underline cursor-pointer${sortBy === 'id' ? ' font-bold' : ''}`}>
                                            ID
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">닉네임</th>
                                    <th className="px-4 py-3">이메일</th>
                                    <th className="px-4 py-3">
                                        <button onClick={() => toggleSort('role')} className={`hover:underline cursor-pointer${sortBy === 'role' ? ' font-bold' : ''}`}>
                                            역할
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button onClick={() => toggleSort('created')} className={`hover:underline cursor-pointer${sortBy === 'created' ? ' font-bold' : ''}`}>
                                            생성일
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    // 행을 클릭하면 상세 패널이 열림; action 버튼은 propagation을 막음.
                                    <tr
                                        key={u.id}
                                        data-testid={`user-row-${u.id}`}
                                        onClick={() => openPanel(u)}
                                        className={`border-t cursor-pointer hover:bg-gray-50${selectedUser?.id === u.id ? ' bg-blue-50' : ''}`}
                                    >
                                        <td className="px-4 py-3">{u.id}</td>
                                        <td className="px-4 py-3">{u.nickname ?? '—'}</td>
                                        <td className="px-4 py-3">{u.email}</td>
                                        <td className="px-4 py-3">
                                            <span data-testid={`user-role-${u.id}`} className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                                                {ROLE_LABEL[u.role] ?? '알 수 없음'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(u.created).toLocaleString('ko-KR')}
                                        </td>
                                        <td className="px-4 py-3 flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                            {myRole === 2 && u.role !== 2 && (
                                                <button
                                                    onClick={() => updateRole(u.id, u.role === 1 ? 0 : 1)}
                                                    data-testid={`user-promote-${u.id}`}
                                                    className="text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                                                >
                                                    {u.role === 1 ? '강등' : '승격'}
                                                </button>
                                            )}
                                            {myRole === 2 && u.role === 2 && u.id !== myUserId && (
                                                <button
                                                    onClick={() => demoteSuperadmin(u.id)}
                                                    data-testid={`user-demote-superadmin-${u.id}`}
                                                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                                                >
                                                    강등 (최고 관리자)
                                                </button>
                                            )}
                                            {myRole !== null && myRole > u.role && (
                                                <button
                                                    onClick={() => forceLogout(u.id)}
                                                    data-testid={`user-force-logout-${u.id}`}
                                                    className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                                >
                                                    강제 로그아웃
                                                </button>
                                            )}
                                            {myRole !== null && myRole > u.role && (
                                                <button
                                                    onClick={() => deleteUser(u.id)}
                                                    data-testid={`user-delete-${u.id}`}
                                                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                                                >
                                                    삭제
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && (
                    <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                        <span>{result.page} / {totalPages} 페이지 (총 {result.total}건)</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => changePage(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1 rounded border disabled:opacity-40"
                            >
                                이전
                            </button>
                            <button
                                onClick={() => changePage(Math.min(totalPages, page + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1 rounded border disabled:opacity-40"
                            >
                                다음
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* User 상세 패널 — 행을 클릭하면 오른쪽에서 슬라이드인됨.
                행에 이미 있는 데이터에 더해 GET /user/:id로 moderation 상태를,
                GET /audit-log?userId로 최근 5건의 권한 작업 기록을 가져옴. */}
            {selectedUser && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSelectedUser(null)}
                    data-testid="panel-backdrop"
                >
                    <div
                        className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                        data-testid="user-detail-panel"
                    >
                        <div className="flex justify-between items-center px-5 py-4 border-b">
                            <h2 className="font-semibold text-gray-800">사용자 상세</h2>
                            <button
                                onClick={() => setSelectedUser(null)}
                                data-testid="panel-close"
                                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">ID</span>
                                <span className="font-mono">{selectedUser.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">이메일</span>
                                <span className="truncate max-w-48">{selectedUser.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">닉네임</span>
                                <span>{selectedUser.nickname ?? '—'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">역할</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLOR[selectedUser.role] ?? ''}`}>
                                    {ROLE_LABEL[selectedUser.role] ?? '알 수 없음'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">가입일</span>
                                <span className="text-gray-600">{new Date(selectedUser.created).toLocaleString('ko-KR')}</span>
                            </div>

                            {panelLoading ? (
                                <p className="text-gray-400 text-xs pt-2">상세 정보를 불러오는 중…</p>
                            ) : (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">상태</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            panelDetail?.status === 'banned' ? 'bg-red-100 text-red-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {panelDetail?.status === 'banned' ? '차단됨' : '정상'}
                                        </span>
                                    </div>
                                    {panelDetail?.bannedUntil && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">차단 해제 예정</span>
                                            <span className="text-red-600 text-xs">{new Date(panelDetail.bannedUntil).toLocaleString('ko-KR')}</span>
                                        </div>
                                    )}
                                    {/* Unban: 사용자가 현재 ban 상태이고 actor의 권한이 더 높을 때만 표시. */}
                                    {panelDetail?.status === 'banned' && myRole !== null && myRole > selectedUser.role && (
                                        <div className="pt-1">
                                            <button
                                                onClick={() => unban(selectedUser.id)}
                                                data-testid={`panel-unban-${selectedUser.id}`}
                                                className="w-full text-xs px-3 py-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
                                            >
                                                차단 해제
                                            </button>
                                        </div>
                                    )}
                                    {/* Ban: 사용자가 아직 ban되지 않았고 actor의 권한이 더 높을 때만 표시. */}
                                    {panelDetail?.status !== 'banned' && myRole !== null && myRole > selectedUser.role && (
                                        <div className="pt-1">
                                            <button
                                                onClick={() => ban(selectedUser.id)}
                                                data-testid={`panel-ban-${selectedUser.id}`}
                                                className="w-full text-xs px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200"
                                            >
                                                차단
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {!panelLoading && panelLogs.length > 0 && (
                            <div className="px-5 pb-5">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">최근 감사 로그</h3>
                                <ul className="space-y-2" data-testid="panel-audit-logs">
                                    {panelLogs.map((log) => (
                                        <li key={log.id} className="text-xs border rounded px-3 py-2 bg-gray-50">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={`px-1.5 py-0.5 rounded font-medium ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                                                    {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                                                </span>
                                                <span className="text-gray-400">{new Date(log.created).toLocaleString('ko-KR')}</span>
                                            </div>
                                            {log.detail && <p className="text-gray-500">{log.detail}</p>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {!panelLoading && panelLogs.length === 0 && (
                            <p className="px-5 text-xs text-gray-400">이 사용자의 감사 로그가 없습니다.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default UsersPage;
