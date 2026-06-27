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
    // The `useForm`, a react-hook-form, tracks, validates, and submits the input value.
    const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (data: RegisterForm) => {
        try {
            // The `btoa` encodes email and password as Base64 based format, same as `register()` and `singIn()` in backend authentication.
            const credential = btoa(`${data.email}:${data.password}`);

            // Nickname (if any) goes in the body — email/password stay in the Basic auth header.
            await api.post('/auth/Register', { nickname: data.nickname || undefined }, {
                // Authenticate by headers
                headers: { Authorization: `Basic ${credential}` },
            });

            setSuccess(true);
            setTimeout(() => navigate('/'), 1500);
            // Move to the chat page
            // navigate('/chat');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string | string[] } } })
                    ?.response?.data?.message;
            setError(
                (Array.isArray(message) ? message.join(' ') : message) ??
                    'Your email already exist.',
            );
        };
    };

    return (
        <div className='flex items-center justify-center h-screen'>
            <div className='flex flex-col gap-4 w-80'>
                <h1 className='text-2xl font-bold'>Sign In</h1>
                {/* `register` collects the value */}
                <input {...register('email', {
                    required: 'Please Enter Your Email',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Email Formed Wrong.' }
                })}
                    placeholder='email'
                    data-testid='register-email-input'
                    className='border p-2 rounded'>
                </input>
                {/* Sign in failure error */}
                {errors.email && <span className='text-red-500 text-sm'>{errors.email.message}</span>}
                {/* {error && <span className='text-red-500 text-sm'>{error}</span>} */}
                <input {...register('password', {
                    required: "Please Enter Your Password",
                    minLength: { value: 8, message: "Password cannot be less than 8 words string" },
                })}
                    type='password'
                    placeholder='password'
                    data-testid='register-password-input'
                    className='border p-2 rounded'>
                </input>
                {errors.password && <span className='text-red-500 text-sm'>{errors.password.message}</span>}
                <input {...register('confirmPassword', {
                    required: 'Please Re-enter Your Password',
                    validate: (value) => value === watch('password') || 'Passwords do not match.',
                })}
                    type='password'
                    placeholder='confirm password'
                    data-testid='register-confirm-password-input'
                    className='border p-2 rounded'>
                </input>
                {errors.confirmPassword && <span className='text-red-500 text-sm'>{errors.confirmPassword.message}</span>}
                <input {...register('nickname', {
                    maxLength: { value: 20, message: 'Nickname must be 20 characters or fewer.' },
                })}
                    placeholder='nickname (optional)'
                    maxLength={20}
                    data-testid='register-nickname-input'
                    className='border p-2 rounded'>
                </input>
                {errors.nickname && <span className='text-red-500 text-sm'>{errors.nickname.message}</span>}
                {error && <span className='text-red-500 text-sm'>{error}</span>}
                {success && <span className='text-green-500 text-sm'>Registration Successful! Redirecting...</span>}
                {/* `handleSubmit(onSubmit)` blocks when failed to validate */}
                <button onClick={handleSubmit(onSubmit)}
                    data-testid='register-submit-button'
                    className='bg-blue-500 text-white p-2 rounded'>
                    Register
                </button>
                <button onClick={() => navigate('/')}
                    data-testid='register-signin-link'
                    className='text-blue-500 text-sm'
                >
                Already have an account? Sign In.
                </button>
            </div>
        </div>
    )
}

export default RegisterPage