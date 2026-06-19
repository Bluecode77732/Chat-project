import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/auth.store'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { recordSessionUser, SESSION_CONFLICT_REASON } from '../auth/session-guard'

interface SignInForm {
    email: string,
    password: string,
};

function SignInPage() {
    // The `useForm`, a react-hook-form, tracks, validates, and submits the input value.
    const { register, handleSubmit, formState: { errors } } = useForm<SignInForm>();
    const { setTokens } = useAuthStore();
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const sessionEnded = searchParams.get('reason') === SESSION_CONFLICT_REASON;

    const onSubmit = async (data: SignInForm) => {
        try {
            // The `btoa` encodes email and password as Base64 based format, same as `register()` and `singIn()` in backend authentication.
            const credential = btoa(`${data.email}:${data.password}`);
            
            // A request method for a basic token, null for no body
            const res = await api.post('/auth/signin', null, {
                // Authenticate by headers
                headers: { Authorization: `Basic ${credential}` },
            });
            
            // Extract userId through JWT decode to identify the User ID
            const decoded = jwtDecode<{ sub: number }>(res.data.accessToken);

            // Saving respond token in Zustand
            setTokens(res.data.accessToken, decoded.sub);
            // Establish this tab's baseline identity for cross-tab session checks
            recordSessionUser(decoded.sub);
            // Move to the chat page
            navigate('/chat');
        } catch {
            setError('Your email or password is not correct.');
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
                {/* `register` collects the value */}
                <input {...register('email', {
                    required: 'Please Enter Your Email',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Email Formed Wrong.' }
                })}
                    placeholder='email'
                    className='border p-2 rounded'>
                </input>
                {/* Sign in failure error */}
                {errors.email && <span className='text-red-500 text-sm'>{errors.email.message}</span>}
                {error && <span className='text-red-500 text-sm'>{error}</span>}
                <input {...register('password', {
                    required: "Please Enter Your Password",
                    minLength: { value: 8, message: "Password cannot be less than 8 words string" },
                })}
                    type='password'
                    placeholder='password'
                    className='border p-2 rounded'>
                </input>
                {errors.password && <span className='text-red-500 text-sm'>{errors.password.message}</span>}
                {/* `handleSubmit(onSubmit)` blocks when failed to validate */}
                <button onClick={handleSubmit(onSubmit)}
                    className='bg-blue-500 text-white p-2 rounded'>
                    Sign In
                </button>
                <button onClick={() => navigate('/register')}
                    className='bg-white text-sm'>
                    Don't have an account? Register.
                </button>
            </div>
        </div>
    )
}

export default SignInPage