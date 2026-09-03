import { useCallback, useEffect, useState } from 'react';
import {
  databaseGeneration,
  ensureDatabaseOpen,
  isDatabaseOpen,
  onDatabaseReconnect,
  reconnectDatabase,
  surveyDatabase,
} from '../db/schema';
import { onError, recentErrors, forgetErrors, type AppError } from '../lib/errors';

/**
 * Goes up each time the connection comes back. Used as a `key`: a live query
 * whose connection died never delivers again, so the screens holding those
 * queries are mounted afresh rather than left showing whatever they had when
 * the database went away.
 */
export function useDatabaseGeneration(): number {
  const [generation, setGeneration] = useState(databaseGeneration);
  useEffect(() => onDatabaseReconnect(() => setGeneration(databaseGeneration())), []);
  return generation;
}

export interface DatabaseHealth {
  isOpen: boolean;
  /** Newest first, and kept across restarts — see lib/errors. */
  errors: AppError[];
  reconnect: () => Promise<boolean>;
  /** What is stuck, table by table — the line that ends the guessing. */
  survey: () => Promise<string>;
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
    // Opening takes a moment, and a screen that exists to answer "is the
    // database there?" must not say no while the answer is still on its way.
    void ensureDatabaseOpen().then(setOpen);

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
    survey: useCallback(async () => {
      const outcome = await surveyDatabase();
      setErrors(recentErrors());
      return outcome;
    }, []),
    clearErrors: useCallback(() => {
      forgetErrors();
      setErrors([]);
    }, []),
  };
}
