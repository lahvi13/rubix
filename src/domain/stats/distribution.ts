import type { Penalty, Solve } from '../../db/types';

/**
 * Session-wide descriptive statistics. All time inputs are final times where
 * null means DNF; DNFs are excluded from every time-based statistic and only
 * show up in the penalty rates.
 */

export interface HistogramBin {
  startMs: number;
  /** Exclusive. */
  endMs: number;
  count: number;
}

const MIN_BIN_WIDTH_MS = 500;
const TARGET_BIN_COUNT = 12;

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

  const width = binWidth(max - min);
  const firstStart = Math.floor(min / width) * width;
  const binCount = Math.floor((max - firstStart) / width) + 1;

  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, index) => ({
    startMs: firstStart + index * width,
    endMs: firstStart + (index + 1) * width,
    count: 0,
  }));
  for (const value of times) {
    const bin = bins[Math.floor((value - firstStart) / width)];
    if (bin !== undefined) bin.count += 1;
  }
  return bins;
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
