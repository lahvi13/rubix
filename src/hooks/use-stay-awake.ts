import { useEffect, useState } from 'react';

/**
 * How long the screen is kept on after the timer was last touched. Long
 * enough for a scramble, a look at the last few times and the next attempt;
 * short enough that a phone left on the timer still goes to sleep.
 */
export const STAY_AWAKE_MS = 5 * 60 * 1000;

/**
 * Keeps the screen from dimming while the timer is in use.
 *
 * A phone that goes dark during inspection, or between two solves while the
 * cube is being scrambled, has to be woken with the hands that are holding
 * the cube. Every change of `activity` counts as use and starts the time over.
 *
 * Asked for, never assumed: the lock is refused on battery saver and missing
 * on older browsers, and neither is anything the reader needs to hear about —
 * the screen simply dims the way it always did. The browser drops the lock
 * whenever the page is hidden, so it is asked for again on the way back.
 */
export function useStayAwake(activity: unknown): void {
  const [seen, setSeen] = useState(activity);
  const [isIdle, setIdle] = useState(false);

  // Adjusted during render: an effect would first paint a screen that is
  // about to be locked on with the lock still released.
  if (seen !== activity) {
    setSeen(activity);
    setIdle(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setIdle(true), STAY_AWAKE_MS);
    return () => window.clearTimeout(timeout);
  }, [activity]);

  useEffect(() => {
    if (isIdle || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let isDone = false;

    const acquire = (): void => {
      if (lock !== null || document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(
        (granted) => {
          if (isDone) {
            void granted.release();
            return;
          }
          lock = granted;
          granted.addEventListener('release', () => {
            if (lock === granted) lock = null;
          });
        },
        () => {},
      );
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      isDone = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lock !== null) void lock.release().catch(() => {});
    };
  }, [isIdle]);
}
