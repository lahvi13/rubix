import { useCallback, useEffect, useRef, useState } from 'react';
import { requestScramble } from '../../../lib/scramble-client';

export interface ScrambleState {
  scramble: string | null;
  error: string | null;
  next: () => void;
}

/**
 * Shows one scramble while the next one is already being generated, so
 * advancing after a solve is instant even though generation takes a moment.
 */
export function useScramble(eventId = '333'): ScrambleState {
  const [scramble, setScramble] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prefetched = useRef<Promise<string> | null>(null);

  const consume = useCallback(() => {
    const upcoming = prefetched.current ?? requestScramble(eventId);
    prefetched.current = requestScramble(eventId);

    upcoming
      .then((value) => {
        setScramble(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, [eventId]);

  useEffect(() => {
    consume();
  }, [consume]);

  return { scramble, error, next: consume };
}
