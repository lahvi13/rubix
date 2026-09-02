import { describe, expect, it } from 'vitest';
import type { Penalty } from '../../db/types';
import {
  histogram,
  penaltyRate,
  sessionMean,
  sessionMedian,
  standardDeviation,
} from './distribution';

describe('sessionMean', () => {
  it.each<[string, (number | null)[], number | null]>([
    ['empty history', [], null],
    ['all DNF', [null, null], null],
    ['ignores DNFs', [1000, null, 2000], 1500],
    ['rounds to whole ms', [1000, 1001, 1001], 1001],
  ])('%s', (_name, finals, expected) => {
    expect(sessionMean(finals)).toBe(expected);
  });
});

describe('sessionMedian', () => {
  it.each<[string, (number | null)[], number | null]>([
    ['empty history', [], null],
    ['all DNF', [null, null], null],
    ['odd count takes the middle', [3000, 1000, 2000], 2000],
    ['even count averages the middle pair', [1000, 2000, 3000, 10_000], 2500],
    ['single solve', [4321], 4321],
    ['DNFs are excluded before picking the middle', [1000, null, null, 3000, 2000], 2000],
  ])('%s', (_name, finals, expected) => {
    expect(sessionMedian(finals)).toBe(expected);
  });
});

describe('standardDeviation', () => {
  it.each<[string, (number | null)[], number | null]>([
    ['empty history', [], null],
    ['all DNF', [null], null],
    ['single solve has zero spread', [5000], 0],
    ['identical times have zero spread', [5000, 5000, 5000], 0],
    // Population SD of {2000, 4000}: mean 3000, variance 1_000_000.
    ['population, not sample', [2000, 4000], 1000],
  ])('%s', (_name, finals, expected) => {
    expect(standardDeviation(finals)).toBe(expected);
  });
});

describe('penaltyRate', () => {
  const solves = (...penalties: Penalty[]) => penalties.map((penalty) => ({ penalty }));

  it('is null with no solves', () => {
    expect(penaltyRate([], 'dnf')).toBeNull();
  });

  it('counts only the asked-for penalty', () => {
    const history = solves('none', 'dnf', 'plus2', 'dnf');
    expect(penaltyRate(history, 'dnf')).toBe(0.5);
    expect(penaltyRate(history, 'plus2')).toBe(0.25);
    expect(penaltyRate(history, 'none')).toBe(0.25);
  });
});

describe('histogram', () => {
  it('is empty for no counting times', () => {
    expect(histogram([])).toEqual([]);
    expect(histogram([null, null])).toEqual([]);
  });

  it('uses the minimum 500ms bin for a tight range', () => {
    const bins = histogram([10_100, 10_400, 11_200]);
    expect(bins).toEqual([
      { startMs: 10_000, endMs: 10_500, count: 2 },
      { startMs: 10_500, endMs: 11_000, count: 0 },
      { startMs: 11_000, endMs: 11_500, count: 1 },
    ]);
  });

  it('puts a single value into a single aligned bin', () => {
    expect(histogram([12_340])).toEqual([{ startMs: 12_000, endMs: 12_500, count: 1 }]);
  });

  it('widens bins on the 1/2/5 grid until the range fits', () => {
    // Range 60s: 500ms would need 120 bins; the first fitting step is 5s.
    const bins = histogram([10_000, 70_000]);
    expect(bins[0]?.startMs).toBe(10_000);
    expect((bins[0]?.endMs ?? 0) - (bins[0]?.startMs ?? 0)).toBe(5000);
    expect(bins.length).toBe(13);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });

  it('excludes DNFs from the bins', () => {
    const bins = histogram([10_000, null, 10_000]);
    expect(bins).toEqual([{ startMs: 10_000, endMs: 10_500, count: 2 }]);
  });
});
