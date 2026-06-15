import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { socket } from '../socket/socket';
import api from '../api/axios';

function AccountPage() {
    const { userId, clearTokens } = useAuthStore();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
