/**
 * Trimmed averages over final times, csTimer convention. All inputs are
 * chronological arrays of final times where null means DNF (see finalMs).
 */

/**
 * A window average. null = not enough solves for the window (shown as an
 * em dash), 'dnf' = more DNFs than the trim can absorb.
 */
export type Average = number | 'dnf' | null;

export const AVERAGE_WINDOWS = [5, 12, 50, 100] as const;
export type AverageWindow = (typeof AVERAGE_WINDOWS)[number];

/** How many solves get cut from EACH side of the window before averaging. */
export function trimCount(n: number): number {
  return n <= 12 ? 1 : Math.ceil(n * 0.05);
}

/** DNFs sort as worse than any time. */
function compareFinals(a: number | null, b: number | null): number {
  return (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
}

/**
 * Trimmed mean of exactly one full window. When a DNF survives the upper trim
 * the whole average is a DNF. Rounded to whole milliseconds — the display
 * layer truncates to hundredths like every other time.
 */
export function windowAverage(finals: readonly (number | null)[]): number | 'dnf' {
  const trim = trimCount(finals.length);
  const kept = [...finals].sort(compareFinals).slice(trim, finals.length - trim);

  let sum = 0;
  for (const value of kept) {
    if (value === null) return 'dnf';
    sum += value;
  }
  return Math.round(sum / kept.length);
}

/** Average of the most recent n solves. */
export function currentAverage(finals: readonly (number | null)[], n: number): Average {
  if (finals.length < n) return null;
  return windowAverage(finals.slice(finals.length - n));
}

/**
 * Best contiguous window of n. A DNF window is worse than any numeric one, so
 * the result is 'dnf' only when every window DNFed.
 */
export function bestAverage(finals: readonly (number | null)[], n: number): Average {
  if (finals.length < n) return null;
  const start = bestAverageStart(finals, n);
  return start === null ? 'dnf' : windowAverage(finals.slice(start, start + n));
}

/**
 * Where the best window of n begins, so the solves behind the number can be
 * shown. The earliest of two equal windows, which is the one that set the
 * record rather than one that matched it. null below the window size and when
 * every window is a DNF — there is no best one to point at.
 */
export function bestAverageStart(finals: readonly (number | null)[], n: number): number | null {
  let bestStart: number | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (let start = 0; start + n <= finals.length; start += 1) {
    const average = windowAverage(finals.slice(start, start + n));
    if (average !== 'dnf' && average < bestMs) {
      bestMs = average;
      bestStart = start;
    }
  }
  return bestStart;
}

/**
 * Which solves of one window the trim cuts, in the window's own order — the
 * ones a list writes in brackets. Of two equal times the earlier is cut at
 * the fast end and the later at the slow end, so exactly trimCount go from
 * each side however many ties there are.
 */
export function trimmedMask(finals: readonly (number | null)[]): boolean[] {
  const trim = trimCount(finals.length);
  const order = finals
    .map((_, index) => index)
    .sort((a, b) => compareFinals(finals[a] ?? null, finals[b] ?? null) || a - b);
  const mask = finals.map(() => false);
  order.forEach((index, rank) => {
    if (rank < trim || rank >= finals.length - trim) mask[index] = true;
  });
  return mask;
}

/**
 * One value per solve for the trend chart: the average of the window ending
 * at that solve. null both before the window fills and for DNF averages, so
 * the line simply has gaps instead of inventing a number.
 */
export function rollingAverage(
  finals: readonly (number | null)[],
  n: number,
): (number | null)[] {
  return finals.map((_, index) => {
    if (index + 1 < n) return null;
    const average = windowAverage(finals.slice(index + 1 - n, index + 1));
    return average === 'dnf' ? null : average;
  });
}
