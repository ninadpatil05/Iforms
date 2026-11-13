import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthCard } from '@/components/AuthCard';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { AlertCircle } from 'lucide-react';
import { AxiosError } from 'axios';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setServerError(null);
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setServerError(detail);
        } else if (err.response.status === 401) {
          setServerError('Invalid email or password.');
        } else {
          setServerError('An error occurred during login. Please try again.');
        }
      } else {
        setServerError('Network error. Please verify the server is running.');
      }
    }
  };

  return (
    <AuthCard title="Welcome Back" subtitle="Sign in to continue">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && (
          <div className="p-3.5 rounded border border-paper-text dark:border-paper-text-dark flex items-start gap-3 text-paper-text dark:text-paper-text-dark text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{serverError}</span>
          </div>
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="space-y-1">
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                alert('Password reset is not enabled in this version.');
              }}
              className="font-mono text-[10px] uppercase tracking-wide text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark focus:outline-none transition-colors duration-160 ease-out"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button type="submit" fullWidth isLoading={isSubmitting} size="lg" className="mt-2">
          Sign In
        </Button>

        <p className="text-center font-mono text-[10px] uppercase tracking-wide text-paper-muted pt-2">
          No account?{' '}
          <Link to="/signup" className="text-paper-ink dark:text-paper-text-dark font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </AuthCard>
  );
};
