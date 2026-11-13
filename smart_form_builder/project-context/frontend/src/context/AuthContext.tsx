import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, SignupPayload } from '@/types/auth';
import * as authApi from '@/api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Apply dark mode class to html document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  }, []);

  // Hydrate user profile on initial mount if token is present
  useEffect(() => {
    const hydrateUser = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        try {
          const userProfile = await authApi.getCurrentUser();
          setUser(userProfile);
          setToken(storedToken);
        } catch {
          logout();
        }
      } else {
        logout();
      }
      setIsLoading(false);
    };

    hydrateUser();
  }, [logout]);

  const login = async (email: string, password: string): Promise<void> => {
    const response = await authApi.login(email, password);
    const accessToken = response.access_token;
    localStorage.setItem('access_token', accessToken);
    setToken(accessToken);

    const userProfile = await authApi.getCurrentUser();
    setUser(userProfile);
  };

  const signup = async (payload: SignupPayload): Promise<void> => {
    await authApi.signup(payload);
    await login(payload.email, payload.password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        theme,
        toggleTheme,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
