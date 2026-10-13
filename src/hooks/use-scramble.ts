import { useCallback, useEffect, useRef, useState } from 'react';
import { requestScramble } from '../lib/scramble-client';

/** A scramble, and the event it was drawn for. */
interface Drawn<T> {
  eventId: string;
  value: T;
}

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
 *
 * Everything held is held with the event it was drawn for. The timer changes
 * event when the app is switched to another cube, and a 3×3 scramble waiting
 * in the prefetch must not come up as the 2×2's first.
 */
export function useScramble(eventId = '333', enabled = true): ScrambleState {
  const [scramble, setScramble] = useState<Drawn<string> | null>(null);
  const [error, setError] = useState<Drawn<string> | null>(null);
  const prefetched = useRef<Drawn<Promise<string>> | null>(null);
  const wanted = useRef(eventId);

  const consume = useCallback(() => {
    if (!enabled) return;
    const waiting = prefetched.current?.eventId === eventId ? prefetched.current.value : null;
    const upcoming = waiting ?? requestScramble(eventId);
    const next = requestScramble(eventId);
    // Nobody awaits the prefetch until the next consume, so without this
    // handler its failure would trip the global unhandled-rejection banner.
    // Consuming it later still receives the rejection and shows the retry.
    next.catch(() => {});
    prefetched.current = { eventId, value: next };

    upcoming
      .then((value) => {
        // One asked for before the event changed answers after it.
        if (wanted.current !== eventId) return;
        setScramble({ eventId, value });
        setError(null);
      })
      .catch((cause: unknown) => {
        if (wanted.current !== eventId) return;
        setError({ eventId, value: cause instanceof Error ? cause.message : String(cause) });
      });
  }, [eventId, enabled]);

  useEffect(() => {
    wanted.current = eventId;
    consume();
  }, [consume, eventId]);

  return {
    // The other event's scramble is not this one's: nothing, until its own is in.
    scramble: scramble?.eventId === eventId ? scramble.value : null,
    error: error?.eventId === eventId ? error.value : null,
    next: consume,
  };
}
