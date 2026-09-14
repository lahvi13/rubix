import type { Penalty, Solve } from '../../db/types';

/**
 * Session-wide descriptive statistics. All time inputs are final times where
 * null means DNF; DNFs are excluded from every time-based statistic and only
 * show up in the penalty rates.
 */

export interface HistogramBin {
  startMs: number;
  /** Exclusive. For the overflow bin, the slowest time in it plus one. */
  endMs: number;
  count: number;
  /**
   * The last bin, holding everything past the outlier fence. It has no width
   * of its own and is read as "startMs and up" — see `histogram`.
   */
  isOverflow: boolean;
}

const MIN_BIN_WIDTH_MS = 500;
const TARGET_BIN_COUNT = 12;

/**
 * Below this the quartiles are guesses and a fence built on them would put
 * ordinary solves in the overflow bin; a short session gets the plain
 * full-range histogram instead.
 */
const MIN_SOLVES_FOR_FENCE = 8;

function countingTimes(finals: readonly (number | null)[]): number[] {
  return finals.filter((value): value is number => value !== null);
}

export function sessionMean(finals: readonly (number | null)[]): number | null {
  const times = countingTimes(finals);
  if (times.length === 0) return null;
  return Math.round(times.reduce((sum, value) => sum + value, 0) / times.length);
}

export function sessionMedian(finals: readonly (number | null)[]): number | null {
  const times = countingTimes(finals).sort((a, b) => a - b);
  const lower = times[Math.floor((times.length - 1) / 2)];
  const upper = times[Math.ceil((times.length - 1) / 2)];
  if (lower === undefined || upper === undefined) return null;
  return Math.round((lower + upper) / 2);
}

/** Population standard deviation — the session is the whole population. */
export function standardDeviation(finals: readonly (number | null)[]): number | null {
  const times = countingTimes(finals);
  if (times.length === 0) return null;
  const mean = times.reduce((sum, value) => sum + value, 0) / times.length;
  const variance = times.reduce((sum, value) => sum + (value - mean) ** 2, 0) / times.length;
  return Math.round(Math.sqrt(variance));
}

/**
 * Fraction 0..1 of solves faster than a goal; null for no solves. Strictly
 * faster, because "sub 1:30" is the goal and a 1:30.00 is not sub it. A DNF
 * is a solve that did not make it, so it stays in the count.
 */
export function shareUnder(finals: readonly (number | null)[], goalMs: number): number | null {
  if (finals.length === 0) return null;
  return finals.filter((value) => value !== null && value < goalMs).length / finals.length;
}

/** Fraction 0..1 of solves carrying the given penalty; null for no solves. */
export function penaltyRate(
  solves: readonly Pick<Solve, 'penalty'>[],
  penalty: Penalty,
): number | null {
  if (solves.length === 0) return null;
  return solves.filter((solve) => solve.penalty === penalty).length / solves.length;
}

/**
 * Fixed-width bins aligned to multiples of the width. The width walks up the
 * 0.5s / 1s / 2s / 5s / 10s… grid until the range fits a readable bin count.
 *
 * One bad solve is not a shape worth building an axis around: a single 2:00 in
 * a session of one-minute solves widened every bin until the rest of the
 * session sat in two of them. Times past the outlier fence are therefore
 * gathered into one overflow bin at the end, which keeps them counted while
 * leaving the width to the solves the session is actually made of.
 */
export function histogram(finals: readonly (number | null)[]): HistogramBin[] {
  const times = countingTimes(finals);
  if (times.length === 0) return [];

  let min = times[0] ?? 0;
  let max = min;
  for (const value of times) {
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const core = Math.min(max, outlierFence(times));
  const width = binWidth(core - min);
  const firstStart = Math.floor(min / width) * width;
  const binCount = Math.floor((core - firstStart) / width) + 1;

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, index) => ({
    startMs: firstStart + index * width,
    endMs: firstStart + (index + 1) * width,
    count: 0,
    isOverflow: false,
  }));

  const overflowStart = firstStart + binCount * width;
  const overflow: HistogramBin = {
    startMs: overflowStart,
    endMs: max + 1,
    count: 0,
    isOverflow: true,
  };

  for (const value of times) {
    if (value >= overflowStart) {
      overflow.count += 1;
      continue;
    }
    const bin = bins[Math.floor((value - firstStart) / width)];
    if (bin !== undefined) bin.count += 1;
  }

  return overflow.count === 0 ? bins : [...bins, overflow];
}

/**
 * Where a time sits along a drawn histogram, as a fraction 0..1 of the whole
 * row of bars — null for a time the bars do not cover.
 *
 * The chart needs this because a bar cannot mark a time on its own: the bin
 * holding the current average is coloured, but an average that falls in a bin
 * no solve landed in has no bar to colour, and the one reading a cuber most
 * wants off this chart — where am I — simply went missing. A fraction rather
 * than a millisecond value, because the bins are drawn as equal bands and the
 * overflow bin covers an open-ended range: it has no inside to point into, so
 * a time in it is put at its middle.
 */
export function histogramPosition(bins: readonly HistogramBin[], ms: number): number | null {
  const index = bins.findIndex((bin) => ms >= bin.startMs && ms < bin.endMs);
  const bin = bins[index];
  if (bin === undefined) return null;
  const within = bin.isOverflow ? 0.5 : (ms - bin.startMs) / (bin.endMs - bin.startMs);
  return (index + within) / bins.length;
}

/**
 * The slowest time that still has a say in how a chart is scaled; Infinity
 * when there are too few solves to tell an outlier from a bad day. DNFs have
 * no time and no say.
 */
export function upperFence(finals: readonly (number | null)[]): number {
  return outlierFence(countingTimes(finals));
}

/**
 * Tukey's upper fence, p75 + 1.5 × IQR. Nothing is dropped by it — it decides
 * only which times stop having a say in how wide a bin is.
 */
function outlierFence(times: readonly number[]): number {
  if (times.length < MIN_SOLVES_FOR_FENCE) return Number.POSITIVE_INFINITY;
  const sorted = [...times].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  return q3 + 1.5 * (q3 - q1);
}

/** Linear interpolation between the two ranks the quantile falls between. */
function quantile(sorted: readonly number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction;
  const lower = sorted[Math.floor(position)] ?? 0;
  const upper = sorted[Math.ceil(position)] ?? lower;
  return lower + (upper - lower) * (position - Math.floor(position));
}

function binWidth(rangeMs: number): number {
  let width = MIN_BIN_WIDTH_MS;
  while (rangeMs / width > TARGET_BIN_COUNT) width = nextStep(width);
  return width;
}

/** 500 -> 1000 -> 2000 -> 5000 -> 10000 -> … stays on the 1/2/5 grid. */
function nextStep(widthMs: number): number {
  const leadingDigit = Number(String(widthMs).charAt(0));
  return leadingDigit === 2 ? widthMs * 2.5 : widthMs * 2;
}
