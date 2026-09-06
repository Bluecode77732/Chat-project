import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/auth.store'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { recordSessionUser, SESSION_CONFLICT_REASON, SESSION_EXPIRED_REASON } from '../auth/session-guard'

interface SignInForm {
    email: string,
    password: string,
};

function SignInPage() {
    // `useForm`(react-hook-form)이 입력값을 추적, 검증, 제출함.
    const { register, handleSubmit, formState: { errors } } = useForm<SignInForm>();
    const { setTokens } = useAuthStore();
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionEnded = searchParams.get('reason') === SESSION_CONFLICT_REASON;
    const sessionExpired = searchParams.get('reason') === SESSION_EXPIRED_REASON;

    const onSubmit = async (data: SignInForm) => {
        try {
            // 백엔드 signIn()이 기대하는 Basic-auth 디코딩 형식과 일치해야 함.
            const credential = btoa(`${data.email}:${data.password}`);

            // 기본 토큰을 위한 요청 메서드, body 없을 땐 null
            const res = await api.post('/auth/signin', null, {
                // 헤더로 인증
                headers: { Authorization: `Basic ${credential}` },
            });

            // JWT 디코드로 User ID를 식별하기 위해 userId를 추출
            const decoded = jwtDecode<{ sub: number }>(res.data.accessToken);

            // 응답받은 토큰을 Zustand에 저장
            setTokens(res.data.accessToken, decoded.sub);
            // cross-tab 세션 체크를 위해 이 탭의 기준 계정을 설정
            recordSessionUser(decoded.sub);
            // 채팅 페이지로 이동
            navigate('/chat');
        } catch (err: unknown) {
            // rate limit(429)에 걸린 경우 서버의 실제 메시지를 그대로 사용; 그 외
            // (잘못된 인증 정보 등)는 백엔드의 사용자 친화적이지 않은 "Invalid User."
            // 텍스트 대신 기존의 일반 메시지를 유지.
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 429) {
                const message = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message;
                setError(message ?? 'Too many attempts, please try again later.');
            } else {
                setError('Your email or password is not correct.');
            }
        };
    };

    return (
        <div className='flex items-center justify-center h-screen'>
            <div className='flex flex-col gap-4 w-80'>
                <h1 className='text-2xl font-bold'>Sign In</h1>
                {sessionEnded && (
                    <span className='text-gray-500 text-sm'>
                        다른 곳에서 로그인되어 세션이 종료되었습니다. 다시 로그인해주세요.
                    </span>
                )}
                {sessionExpired && (
                    <span className='text-gray-500 text-sm'>
                        로그인 세션이 만료되어 로그아웃되었습니다. 다시 로그인해주세요.
                    </span>
                )}
                {/* `register`가 값을 수집 */}
                <input {...register('email', {
                    required: 'Please Enter Your Email',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Email Formed Wrong.' }
                })}
                    placeholder='email'
                    data-testid='signin-email-input'
                    className='border p-2 rounded'>
                </input>
                {/* 로그인 실패 에러 */}
                {errors.email && <span className='text-red-500 text-sm'>{errors.email.message}</span>}
                {error && <span className='text-red-500 text-sm'>{error}</span>}
                <input {...register('password', {
                    required: "Please Enter Your Password",
                    minLength: { value: 8, message: "Password cannot be less than 8 words string" },
                })}
                    type='password'
                    placeholder='password'
                    data-testid='signin-password-input'
                    className='border p-2 rounded'>
                </input>
                {errors.password && <span className='text-red-500 text-sm'>{errors.password.message}</span>}
                {/* `handleSubmit(onSubmit)`은 검증 실패 시 막음 */}
                <button onClick={handleSubmit(onSubmit)}
                    data-testid='signin-submit-button'
                    className='bg-blue-500 text-white p-2 rounded'>
                    Sign In
                </button>
                <button onClick={() => navigate('/register')}
                    data-testid='signin-register-link'
                    className='bg-white text-sm'>
                    Don't have an account? Register.
                </button>
            </div>
        </div>
    )
}

export default SignInPage