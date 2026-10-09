/**
 * What the next solve needs to set a new best aoN — the number to chase while
 * the window is one solve short of rolling over.
 */

import { bestAverage, windowAverage } from './averages';

export type RecordThreshold =
  /** A result under `belowMs` sets it. Already rounded down to what the clock shows. */
  | { kind: 'below'; belowMs: number }
  /** Not even the fastest result the clock could show would set it. */
  | { kind: 'out-of-reach' };

/**
 * null until there is a record to beat: below n solves there is no aoN at all,
 * and with every window a DNF there is no best one.
 *
 * The average only grows with the next result, so the cut-off is found by
 * bisection over whole milliseconds rather than solved for: the trim decides
 * which solves count, and where the next one lands changes that.
 *
 * There is no "a DNF would do": the window ending one solve ago held the same
 * n − 1 solves plus a real result, so it was already at least as good as these
 * plus a DNF — and the record is at least as good as that window.
 */
export function recordThreshold(
  finals: readonly (number | null)[],
  n: number,
): RecordThreshold | null {
  if (n < 2 || finals.length < n) return null;
  const best = bestAverage(finals, n);
  if (typeof best !== 'number') return null;

  const others = finals.slice(finals.length - (n - 1));
  const beats = (next: number | null) => {
    const average = windowAverage([...others, next]);
    return average !== 'dnf' && average < best;
  };

  if (!beats(0)) return { kind: 'out-of-reach' };

  // Past n times the record the next result would be the slowest of the
  // window, which never beats it (above).
  let fast = 0;
  let slow = best * n;
  while (slow - fast > 1) {
    const middle = Math.floor((fast + slow) / 2);
    if (beats(middle)) fast = middle;
    else slow = middle;
  }
  // `fast` is the slowest result that still sets it. The clock cuts to
  // hundredths, so the promise is made in hundredths too: anything the clock
  // shows under this did set it, however the milliseconds behind it fall.
  const belowMs = Math.floor((fast + 1) / 10) * 10;
  return belowMs === 0 ? { kind: 'out-of-reach' } : { kind: 'below', belowMs };
}
