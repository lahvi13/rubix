import { useCallback, useEffect, useRef, useState } from 'react';
import { requestScramble } from '../lib/scramble-client';

export interface ScrambleState {
  scramble: string | null;
  error: string | null;
  next: () => void;
}

/**
 * Shows one scramble while the next one is already being generated, so
 * advancing after a solve is instant even though generation takes a moment.
 *
 * `enabled` is not a convenience: generating anything loads cubing.js, a
 * chunk worth avoiding on a screen that does not need it — the drill only
 * scrambles for real when it is drilling the cross.
 */
export function useScramble(eventId = '333', enabled = true): ScrambleState {
  const [scramble, setScramble] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prefetched = useRef<Promise<string> | null>(null);

  const consume = useCallback(() => {
    if (!enabled) return;
    const upcoming = prefetched.current ?? requestScramble(eventId);
    const next = requestScramble(eventId);
    // Nobody awaits the prefetch until the next consume, so without this
    // handler its failure would trip the global unhandled-rejection banner.
    // Consuming it later still receives the rejection and shows the retry.
    next.catch(() => {});
    prefetched.current = next;

    upcoming
      .then((value) => {
        setScramble(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
  }, [eventId, enabled]);

  useEffect(() => {
    consume();
  }, [consume]);

  return { scramble, error, next: consume };
}
