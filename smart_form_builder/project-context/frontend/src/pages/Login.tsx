import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthCard } from '@/components/AuthCard';
import { Input } from '@/components/Input';
import { Checkbox } from '@/components/Checkbox';
import { Button } from '@/components/Button';
import { InlineBanner } from '@/components/InlineBanner';
import { ArrowRight } from 'lucide-react';
import { AxiosError } from 'axios';

const loginSchema = z.object({
  email: z.string().min(1, 'Email address is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    },
  });

  const rememberMe = watch('rememberMe');

  const onSubmit = async (data: LoginFormData) => {
    try {
      setServerError(null);
      setNoticeMessage(null);
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setServerError(detail);
        } else if (err.response.status === 401) {
          setServerError('Incorrect email or password. Please check your credentials.');
        } else {
          setServerError('An error occurred during sign in. Please try again.');
        }
      } else {
        setServerError('Network connection error. Please verify the backend API server is running.');
      }
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setNoticeMessage('Password reset is not available yet. Please contact your system administrator.');
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your account to manage your forms."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <InlineBanner
            variant="error"
            message={serverError}
            onDismiss={() => setServerError(null)}
          />
        )}

        {noticeMessage && (
          <InlineBanner
            variant="info"
            message={noticeMessage}
            onDismiss={() => setNoticeMessage(null)}
          />
        )}

        <Input
          label="Email Address"
          type="email"
          placeholder="jane@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          showPasswordToggle
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAction={
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-terracotta hover:underline font-medium focus:outline-none transition-colors bg-transparent border-none cursor-pointer"
            >
              Forgot password?
            </button>
          }
          {...register('password')}
        />

        <div className="flex items-center justify-between pt-1">
          <Checkbox
            label="Remember me on this device"
            checked={rememberMe}
            onChange={(e) => setValue('rememberMe', e.target.checked)}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isSubmitting}
          size="lg"
          rightIcon={<ArrowRight size={18} />}
          className="mt-2"
        >
          Sign In
        </Button>

        <div className="text-center pt-3 border-t border-paper-border mt-6">
          <p className="text-xs text-ink-muted">
            Don't have an account?{' '}
            <Link to="/signup" className="text-terracotta font-semibold hover:underline">
              Create one now
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-ink-subtle mt-4">
          By signing in, you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </AuthCard>
  );
};
