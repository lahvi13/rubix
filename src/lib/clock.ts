/**
 * Every timestamp in the app goes through here, so tests can substitute a
 * clock and the domain never has to reach for a global.
 */

let lastIssued = 0;

/**
 * Wall-clock time for stored timestamps (createdAt, updatedAt, ...).
 *
 * Never returns the same value twice, so createdAt is a total order and lists
 * sorted by it are stable. Without that, two rows written in the same
 * millisecond fall back to comparing random UUIDs. As a side effect this also
 * survives the system clock being adjusted backwards mid-session.
 */
export function now(): number {
  lastIssued = Math.max(Date.now(), lastIssued + 1);
  return lastIssued;
}

/**
 * Monotonic time for measuring. Immune to system clock adjustments, which is
 * the whole point when a solve is being timed to the hundredth.
 */
export function monotonicNow(): number {
  return performance.now();
}

/**
 * How long an event may have waited for its handler and still be trusted.
 * Anything older is more likely a timestamp on some other clock.
 */
const MAX_EVENT_AGE_MS = 1000;

/**
 * When an input event happened, on the monotonic clock.
 *
 * The event's own timestamp, not the moment its handler got to run: a phone
 * busy with a frame hands the touch over tens of milliseconds late, and a
 * clock read in the handler adds all of that to the solve. The timestamp is
 * trusted only when it is on the same clock — some engines have stamped
 * events with epoch time, and so does jsdom — and the handler's own reading
 * stands in otherwise.
 */
export function eventTime(timeStamp: number): number {
  const at = monotonicNow();
  return timeStamp > 0 && timeStamp <= at && at - timeStamp < MAX_EVENT_AGE_MS ? timeStamp : at;
}
