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

const signupSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export const Signup: React.FC = () => {
  const { signup } = useAuth();
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
          setServerError('An account with this email already exists.');
        } else {
          setServerError('Failed to create account. Please try again.');
        }
      } else {
        setServerError('Network error. Please verify the server is running.');
      }
    }
  };

  return (
    <AuthCard title="Create Account" subtitle="Join Smart Form Builder">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError && (
          <div className="p-3.5 rounded border border-paper-text dark:border-paper-text-dark flex items-start gap-3 text-paper-text dark:text-paper-text-dark text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{serverError}</span>
          </div>
        )}

        <Input
          label="Full Name"
          type="text"
          placeholder="Your Name"
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="name@gmail.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Re-enter password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" fullWidth isLoading={isSubmitting} size="lg" className="mt-2">
          Create Account
        </Button>

        <p className="text-center font-mono text-[10px] uppercase tracking-wide text-paper-muted pt-2">
          Already have an account?{' '}
          <Link to="/login" className="text-paper-ink dark:text-paper-text-dark font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
};
