import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-base dark:bg-paper-base-dark">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-paper-ink dark:border-paper-text-dark border-t-transparent rounded-full animate-spin"></div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper-muted">Authenticating…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
