import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import api from '../api/axios'

interface RegisterForm {
    email: string,
    password: string,
};

function RegisterPage() {
    // The `useForm`, a react-hook-form, tracks, validates, and submits the input value.
    const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (data: RegisterForm) => {
        try {
            // The `btoa` encodes email and password as Base64 based format, same as `register()` and `singIn()` in backend authentication.
            const credential = btoa(`${data.email}:${data.password}`);

            // A request method for a basic token, null for no body
            await api.post('/auth/Register', null, {
                // Authenticate by headers
                headers: { Authorization: `Basic ${credential}` },
            });

            setSuccess(true);
            setTimeout(() => navigate('/'), 1500);
            // Move to the chat page
            // navigate('/chat');
        } catch {
            setError('Your email already exist.');
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
                    className='border p-2 rounded'>
                </input>
                {errors.password && <span className='text-red-500 text-sm'>{errors.password.message}</span>}
                {error && <span className='text-red-500 text-sm'>{error}</span>}
                {success && <span className='text-green-500 text-sm'>Registration Successful! Redirecting...</span>}
                {/* `handleSubmit(onSubmit)` blocks when failed to validate */}
                <button onClick={handleSubmit(onSubmit)}
                    className='bg-blue-500 text-white p-2 rounded'>
                    Register
                </button>
                <button onClick={() => navigate('/')}
                    className='text-blue-500 text-sm'
                >
                Already have an account? Sign In.
                </button>
            </div>
        </div>
    )
}

export default RegisterPage