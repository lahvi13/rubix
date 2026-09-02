import { useEffect, useState } from 'react';

/**
 * A confirmation that cannot be clicked through. Arming starts a countdown and
 * the action only unlocks when it reaches zero — a second identical button is
 * something the hand learns to hit twice, a few seconds of waiting is not.
 */
export function useConfirmDelay(seconds: number) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (remaining === null || remaining === 0) return;
    const handle = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(handle);
  }, [remaining]);

  return {
    isArmed: remaining !== null,
    isReady: remaining === 0,
    remaining: remaining ?? seconds,
    arm: () => setRemaining(seconds),
    reset: () => setRemaining(null),
  };
}
