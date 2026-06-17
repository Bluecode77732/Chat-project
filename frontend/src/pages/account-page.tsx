import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { socket } from '../socket/socket';
import api from '../api/axios';

interface UserInfo {
    email: string;
    nickname: string | null;
}

function AccountPage() {
    const { userId, clearTokens } = useAuthStore();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [email, setEmail] = useState('');
    const [nickname, setNickname] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        if (!userId) return;
        api.get<UserInfo>(`/user/${userId}`)
            .then(({ data }) => {
                setEmail(data.email);
                setNickname(data.nickname ?? '');
            })
            .catch(() => setProfileError('계정 정보를 불러오지 못했습니다.'));
    }, [userId]);

    const handleProfileUpdate = async () => {
        if (!userId) return;
        setProfileLoading(true);
        setProfileError(null);
        setProfileSuccess(null);
        try {
            await api.patch(`/user/${userId}`, {
                email,
                nickname,
                ...(newPassword ? { password: newPassword } : {}),
            });
            setNewPassword('');
            setProfileSuccess('변경사항이 저장되었습니다.');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? '저장에 실패했습니다.';
            setProfileError(message);
        } finally {
            setProfileLoading(false);
        }
    };

    const handleDeleteRequest = () => {
        if (!password.trim()) {
            setError('비밀번호를 입력해주세요.');
            return;
        }
        setError(null);
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/user/${userId}`, { data: { password } });
            // 소켓 해제 → 토큰 정리 → 로그인 화면
            socket.disconnect();
            clearTokens();
            navigate('/');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? '탈퇴에 실패했습니다. 비밀번호를 확인해주세요.';
            setError(message);
            setShowConfirm(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-8">
                <span className="font-bold text-lg">계정 설정</span>
                <button
                    onClick={() => navigate('/chat')}
                    className="text-sm text-gray-500 hover:text-gray-700"
                >
                    ← 채팅으로 돌아가기
                </button>
            </div>

            <div className="border border-gray-200 rounded-lg p-6 mb-6">
                <h2 className="font-semibold mb-4">프로필</h2>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border p-2 rounded mb-3 text-sm"
                    disabled={profileLoading}
                />

                <label className="block text-sm font-medium text-gray-700 mb-1">
                    닉네임
                </label>
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full border p-2 rounded mb-3 text-sm"
                    placeholder="다른 유저에게 표시될 이름"
                    disabled={profileLoading}
                />

                <label className="block text-sm font-medium text-gray-700 mb-1">
                    새 비밀번호
                </label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border p-2 rounded mb-3 text-sm"
                    placeholder="변경하지 않으려면 비워두세요"
                    disabled={profileLoading}
                />

                {profileError && (
                    <p className="text-red-500 text-sm mb-3">{profileError}</p>
                )}
                {profileSuccess && (
                    <p className="text-green-600 text-sm mb-3">{profileSuccess}</p>
                )}

                <button
                    onClick={handleProfileUpdate}
                    disabled={profileLoading || !email.trim()}
                    className="w-full bg-blue-500 text-white py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                >
                    {profileLoading ? '저장 중...' : '저장'}
                </button>
            </div>

            <div className="border border-red-200 rounded-lg p-6">
                <h2 className="text-red-600 font-semibold mb-1">계정 탈퇴</h2>
                <p className="text-sm text-gray-500 mb-4">
                    탈퇴 시 계정은 즉시 삭제됩니다. 채팅 이력은 상대방이 탈퇴할 때까지 보존됩니다.
                </p>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                    현재 비밀번호
                </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleDeleteRequest(); }}
                    className="w-full border p-2 rounded mb-3 text-sm"
                    placeholder="비밀번호 입력"
                    disabled={loading}
                />

                {error && (
                    <p className="text-red-500 text-sm mb-3">{error}</p>
                )}

                <button
                    onClick={handleDeleteRequest}
                    disabled={loading}
                    className="w-full bg-red-500 text-white py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50"
                >
                    계정 탈퇴
                </button>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
                        <h3 className="font-bold mb-2">정말 탈퇴하시겠습니까?</h3>
                        <p className="text-sm text-gray-500 mb-5">
                            이 작업은 되돌릴 수 없습니다.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={loading}
                                className="flex-1 border py-2 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className="flex-1 bg-red-500 text-white py-2 rounded text-sm hover:bg-red-600 disabled:opacity-50"
                            >
                                {loading ? '처리 중...' : '탈퇴 확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AccountPage;
