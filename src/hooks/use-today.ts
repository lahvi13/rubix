import { useEffect, useState } from 'react';
import { now } from '../lib/clock';
import { dayKey, startOfNextDay } from '../lib/format';

/**
 * The reader's today, as a day key, and a new one when the day turns.
 *
 * A screen that counts back from today — a streak, the last thirty days —
 * works it out once and then stands still, and the app is the kind that is
 * left open on a desk overnight: in the morning it said yesterday was today.
 *
 * Woken at the next midnight, and asked again whenever the page comes back to
 * the front: a phone does not run a timer while the app is put away, so the
 * midnight that passed in a pocket is noticed on the way back instead.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey(now()));

  useEffect(() => {
    let handle: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const at = now();
      // The same key again is no change, and React leaves the screen alone.
      setToday(dayKey(at));
      clearTimeout(handle);
      handle = setTimeout(check, startOfNextDay(at) - at);
    };
    const onShow = () => {
      if (document.visibilityState === 'visible') check();
    };

    check();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearTimeout(handle);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);

  return today;
}
