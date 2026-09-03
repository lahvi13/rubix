import { useCallback, useEffect, useState } from 'react';
import { isDatabaseOpen, reconnectDatabase } from '../db/schema';
import { onError, recentErrors, forgetErrors, type AppError } from '../lib/errors';

export interface DatabaseHealth {
  isOpen: boolean;
  /** Newest first, and kept across restarts — see lib/errors. */
  errors: AppError[];
  reconnect: () => Promise<boolean>;
  clearErrors: () => void;
}

/**
 * The state of the connection everything else depends on. Its own hook because
 * a phone gives no other way to find out: when IndexedDB stops answering, the
 * screens simply keep their last contents and taps do nothing.
 */
export function useDatabaseHealth(): DatabaseHealth {
  const [isOpen, setOpen] = useState(isDatabaseOpen);
  const [errors, setErrors] = useState<AppError[]>(recentErrors);

  useEffect(() => {
    const stop = onError(() => {
      setErrors(recentErrors());
      setOpen(isDatabaseOpen());
    });
    const timer = setInterval(() => setOpen(isDatabaseOpen()), 2000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, []);

  return {
    isOpen,
    errors,
    reconnect: useCallback(async () => {
      const reconnected = await reconnectDatabase();
      setOpen(reconnected);
      setErrors(recentErrors());
      return reconnected;
    }, []),
    clearErrors: useCallback(() => {
      forgetErrors();
      setErrors([]);
    }, []),
  };
}
