import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import { useAuthStore } from '../store/auth.store';
import { recordSessionUser } from '../auth/session-guard';
import { useState } from 'react';

interface LoginForm {
    email: string;
    password: string;
}

function LoginPage() {
    const { register, handleSubmit } = useForm<LoginForm>();
    const { setTokens } = useAuthStore();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const onSubmit = async (data: LoginForm) => {
        setError('');
        try {
            const base64 = btoa(`${data.email}:${data.password}`);
            const res = await api.post('/auth/signin', null, {
                headers: { Authorization: `Basic ${base64}` },
            });
            const { sub, role } = jwtDecode<{ sub: number; role: number }>(res.data.accessToken);
            if (role < 1) {
                setError('관리자 전용입니다.');
                return;
            }
            setTokens(res.data.accessToken, sub, role);
            // cross-tab 세션 체크를 위해 이 탭의 기준 계정을 설정
            recordSessionUser(sub);
            navigate('/dashboard');
        } catch {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="bg-white p-8 rounded-xl shadow w-80 flex flex-col gap-4"
            >
                <h1 className="text-xl font-bold text-center">관리자 로그인</h1>
                {error && <p data-testid="login-error" className="text-red-500 text-sm text-center">{error}</p>}
                <input
                    {...register('email', { required: true })}
                    type="email"
                    placeholder="이메일"
                    data-testid="login-email-input"
                    className="border rounded px-3 py-2 text-sm"
                />
                <input
                    {...register('password', { required: true })}
                    type="password"
                    placeholder="비밀번호"
                    data-testid="login-password-input"
                    className="border rounded px-3 py-2 text-sm"
                />
                <button
                    type="submit"
                    data-testid="login-submit-button"
                    className="bg-blue-600 text-white rounded py-2 text-sm font-semibold hover:bg-blue-700"
                >
                    로그인
                </button>
            </form>
        </div>
    );
}

export default LoginPage;
