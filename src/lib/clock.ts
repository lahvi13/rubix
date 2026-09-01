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
