import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { captureAppError } from '../services/observabilityService';

export function AppObservability({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      captureAppError(event.error ?? event.message, {
        source: 'window.error',
        userId: user?.id,
        details: `${event.filename}:${event.lineno}:${event.colno}`,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      captureAppError(event.reason, {
        source: 'window.unhandledrejection',
        userId: user?.id,
      });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [user?.id]);

  return children;
}
