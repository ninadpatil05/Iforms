import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastItem, ToastMessage, ToastVariant } from '@/components/Toast';

interface ToastContextType {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const success = useCallback(
    (title: string, message?: string) => addToast({ title, message, variant: 'success' }),
    [addToast]
  );
  const error = useCallback(
    (title: string, message?: string) => addToast({ title, message, variant: 'error' }),
    [addToast]
  );
  const warning = useCallback(
    (title: string, message?: string) => addToast({ title, message, variant: 'warning' }),
    [addToast]
  );
  const info = useCallback(
    (title: string, message?: string) => addToast({ title, message, variant: 'info' }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, success, error, warning, info, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastMessage toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
