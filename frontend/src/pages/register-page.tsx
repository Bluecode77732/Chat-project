import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import api from '../api/axios'

interface RegisterForm {
    email: string,
    password: string,
    confirmPassword: string,
    nickname?: string,
};

function RegisterPage() {
    // `useForm`(react-hook-form)이 입력값을 추적, 검증, 제출함.
    const { register, handleSubmit, getValues, formState: { errors } } = useForm<RegisterForm>();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (data: RegisterForm) => {
        try {
            // 백엔드 register()가 기대하는 Basic-auth 디코딩 형식과 일치해야 함.
            const credential = btoa(`${data.email}:${data.password}`);

            // 닉네임(있다면)은 body에 — email/password는 Basic auth 헤더에 유지.
            await api.post('/auth/Register', { nickname: data.nickname || undefined }, {
                // 헤더로 인증
                headers: { Authorization: `Basic ${credential}` },
            });

            setSuccess(true);
            setTimeout(() => navigate('/'), 1500);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string | string[] } } })
                    ?.response?.data?.message;
            setError(
                (Array.isArray(message) ? message.join(' ') : message) ??
                    '이미 가입된 이메일입니다.',
            );
        };
    };

    return (
        <div className='flex items-center justify-center h-screen'>
            <div className='flex flex-col gap-4 w-80'>
                <h1 className='text-2xl font-bold'>회원가입</h1>
                {/* `register`가 값을 수집 */}
                <input {...register('email', {
                    required: '이메일을 입력해주세요.',
                    pattern: { value: /\S+@\S+\.\S+/, message: '이메일 형식이 올바르지 않습니다.' }
                })}
                    placeholder='이메일'
                    data-testid='register-email-input'
                    className='border p-2 rounded'>
                </input>
                {/* 로그인 실패 에러 */}
                {errors.email && <span className='text-red-500 text-sm'>{errors.email.message}</span>}
                <input {...register('password', {
                    required: '비밀번호를 입력해주세요.',
                    minLength: { value: 8, message: '비밀번호는 8자 이상이어야 합니다.' },
                })}
                    type='password'
                    placeholder='비밀번호'
                    data-testid='register-password-input'
                    className='border p-2 rounded'>
                </input>
                {errors.password && <span className='text-red-500 text-sm'>{errors.password.message}</span>}
                <input {...register('confirmPassword', {
                    required: '비밀번호를 다시 입력해주세요.',
                    validate: (value) => value === getValues('password') || '비밀번호가 일치하지 않습니다.',
                })}
                    type='password'
                    placeholder='비밀번호 확인'
                    data-testid='register-confirm-password-input'
                    className='border p-2 rounded'>
                </input>
                {errors.confirmPassword && <span className='text-red-500 text-sm'>{errors.confirmPassword.message}</span>}
                <input {...register('nickname', {
                    maxLength: { value: 20, message: '닉네임은 20자 이하여야 합니다.' },
                })}
                    placeholder='닉네임 (선택)'
                    maxLength={20}
                    data-testid='register-nickname-input'
                    className='border p-2 rounded'>
                </input>
                {errors.nickname && <span className='text-red-500 text-sm'>{errors.nickname.message}</span>}
                {error && <span className='text-red-500 text-sm'>{error}</span>}
                {success && <span className='text-green-500 text-sm'>회원가입이 완료되었습니다. 이동 중...</span>}
                {/* `handleSubmit(onSubmit)`은 검증 실패 시 막음 */}
                <button onClick={handleSubmit(onSubmit)}
                    data-testid='register-submit-button'
                    className='bg-blue-500 text-white p-2 rounded'>
                    회원가입
                </button>
                <button onClick={() => navigate('/')}
                    data-testid='register-signin-link'
                    className='text-blue-500 text-sm'
                >
                이미 계정이 있으신가요? 로그인
                </button>
            </div>
        </div>
    )
}

export default RegisterPage