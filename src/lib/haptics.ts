/**
 * A short buzz under the fingers. With a cube in both hands nobody watches the
 * clock turn green, but the hands resting on the phone feel it.
 *
 * Android only in practice: Safari has no Vibration API at all, and a desktop
 * has nothing to vibrate. Like the beep, it is a nicety — it never throws.
 */

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Short enough to read as a tick, not as a notification arriving. */
const TICK_MS = 15;

export function buzz(durationMs = TICK_MS): void {
  try {
    if (canVibrate()) navigator.vibrate(durationMs);
  } catch {
    // Chrome refuses before the first tap on the page; that is not an error.
  }
}
