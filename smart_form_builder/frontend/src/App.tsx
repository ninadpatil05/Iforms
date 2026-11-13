import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import { Dashboard } from '@/pages/Dashboard';
import { Forms } from '@/pages/Forms';
import { FormDetail } from '@/pages/FormDetail';
import { FormBuilder } from '@/pages/FormBuilder';
import { Analytics } from '@/pages/Analytics';
import { AIFormGenerator } from '@/pages/AIFormGenerator';
import { AIFormAnalyzer } from '@/pages/AIFormAnalyzer';
import { PublicFormFill } from '@/pages/PublicFormFill';
import { LandingPage } from '@/pages/LandingPage';

const RootRedirect: React.FC = () => {
  return <LandingPage />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/f/:publicLink" element={<PublicFormFill />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms"
        element={
          <ProtectedRoute>
            <Forms />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai/generate"
        element={
          <ProtectedRoute>
            <AIFormGenerator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:formId"
        element={
          <ProtectedRoute>
            <FormDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:formId/build"
        element={
          <ProtectedRoute>
            <FormBuilder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:formId/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forms/:formId/ai-analysis"
        element={
          <ProtectedRoute>
            <AIFormAnalyzer />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
