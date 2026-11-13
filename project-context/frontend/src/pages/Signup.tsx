import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AuthCard } from '@/components/AuthCard';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { InlineBanner } from '@/components/InlineBanner';
import { ArrowRight } from 'lucide-react';
import { AxiosError } from 'axios';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

const signupSchema = z
  .object({
    name: z.string().min(1, 'Full Name is required').max(100, 'Name is too long'),
    email: z.string().min(1, 'Email Address is required').email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export const Signup: React.FC = () => {
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    try {
      setServerError(null);
      await signup({
        name: data.name,
        email: data.email,
        password: data.password,
        role: 'user',
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setServerError(detail);
        } else if (err.response.status === 409) {
          setServerError('An account with this email address already exists.');
        } else {
          setServerError('Failed to create account. Please check your inputs and try again.');
        }
      } else {
        setServerError('Network connection error. Please verify the backend API server is running.');
      }
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setServerError('No credential received from Google. Please try again.');
      return;
    }
    try {
      setServerError(null);
      await loginWithGoogle(credentialResponse.credential);
      navigate('/dashboard');
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setServerError(detail);
        } else if (err.response.status === 401) {
          setServerError('Google authentication failed. Please check your credentials.');
        } else {
          setServerError('An error occurred during Google sign in. Please try again.');
        }
      } else {
        setServerError('Network connection error. Please verify the backend API server is running.');
      }
    }
  };

  const handleGoogleError = () => {
    setServerError('Google sign-in failed. Please try again.');
  };

  return (
    <AuthCard
      title="Start building"
      subtitle="Create your free account to design beautiful forms."
    >
      <div className="space-y-4">
        <div className="flex justify-center w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            shape="rectangular"
            theme="outline"
            size="large"
            width="384"
          />
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-paper-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-paper-lowest px-2 text-ink-muted">
              or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {serverError && (
            <InlineBanner
              variant="error"
              message={serverError}
              onDismiss={() => setServerError(null)}
            />
          )}

          <Input
            label="Full Name"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />

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
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            label="Confirm Password"
            type="password"
            showPasswordToggle
            placeholder="••••••••"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isSubmitting}
            size="lg"
            rightIcon={<ArrowRight size={18} />}
            className="mt-3"
          >
            Create Account
          </Button>

          <div className="text-center pt-3 mt-4">
            <p className="text-xs text-ink-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-terracotta font-semibold hover:underline">
                Sign in instead
              </Link>
            </p>
          </div>

          <div className="pt-4 border-t border-dashed border-paper-border mt-5 text-center">
            <p className="text-[11px] text-ink-subtle leading-relaxed">
              By signing up, you agree to our Terms and Privacy Policy.
            </p>
          </div>
        </form>
      </div>
    </AuthCard>
  );
};
