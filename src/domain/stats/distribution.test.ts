import { describe, expect, it } from 'vitest';
import type { Penalty } from '../../db/types';
import {
  histogram,
  histogramPosition,
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
      { startMs: 10_000, endMs: 10_500, count: 2, isOverflow: false },
      { startMs: 10_500, endMs: 11_000, count: 0, isOverflow: false },
      { startMs: 11_000, endMs: 11_500, count: 1, isOverflow: false },
    ]);
  });

  it('puts a single value into a single aligned bin', () => {
    expect(histogram([12_340])).toEqual([
      { startMs: 12_000, endMs: 12_500, count: 1, isOverflow: false },
    ]);
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
    expect(bins).toEqual([{ startMs: 10_000, endMs: 10_500, count: 2, isOverflow: false }]);
  });

  it('keeps a lone slow solve out of the bin width', () => {
    // Nineteen solves around a minute and one at two minutes: the width has to
    // come from the minute, not from the gap up to the outlier.
    const session = [...Array.from({ length: 19 }, (_, index) => 58_000 + index * 200), 120_000];
    const bins = histogram(session);
    const overflow = bins[bins.length - 1];

    expect(overflow?.isOverflow).toBe(true);
    expect(overflow?.count).toBe(1);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(20);
    // Without the fence this would be 5s bins spanning a whole minute.
    expect((bins[0]?.endMs ?? 0) - (bins[0]?.startMs ?? 0)).toBe(500);
  });

  it('adds no overflow bin when nothing is past the fence', () => {
    const session = Array.from({ length: 12 }, (_, index) => 10_000 + index * 100);
    expect(histogram(session).some((bin) => bin.isOverflow)).toBe(false);
  });

  it('does not fence a session too short for quartiles', () => {
    // Five solves: the 2:00 is still the end of the axis, because with this
    // few times there is no telling an outlier from a bad day.
    const bins = histogram([58_000, 58_500, 59_000, 59_500, 120_000]);
    expect(bins.some((bin) => bin.isOverflow)).toBe(false);
    expect(bins[bins.length - 1]?.endMs).toBeGreaterThan(120_000);
  });
});

describe('histogramPosition', () => {
  const bins = histogram([10_000, 11_000, 12_000]);

  it('has bins to place a time in', () => {
    expect(bins).toHaveLength(5);
    expect(bins[0]?.startMs).toBe(10_000);
    expect(bins[4]?.endMs).toBe(12_500);
  });

  it.each<[string, number, number | null]>([
    ['the very start of the row', 10_000, 0],
    ['halfway into the first bin', 10_250, 0.1],
    ['the start of the last bin', 12_000, 0.8],
    ['the last instant the row covers', 12_499, 0.9996],
    ['a time faster than every bin', 9_999, null],
    ['a time past the end of the row', 12_500, null],
  ])('places %s', (_name, ms, expected) => {
    const position = histogramPosition(bins, ms);
    if (expected === null) expect(position).toBeNull();
    else expect(position).toBeCloseTo(expected, 4);
  });

  it('has no position on an empty histogram', () => {
    expect(histogramPosition([], 10_000)).toBeNull();
  });

  it('puts a time inside the overflow bin at its middle', () => {
    // The overflow bin is open-ended, so there is no "how far into it" to
    // measure; anything in it is marked at the band's centre.
    const session = [...Array.from({ length: 19 }, (_, index) => 58_000 + index * 200), 120_000];
    const fenced = histogram(session);
    const overflow = fenced[fenced.length - 1];

    expect(overflow?.isOverflow).toBe(true);
    const middle = (fenced.length - 0.5) / fenced.length;
    expect(histogramPosition(fenced, 120_000)).toBeCloseTo(middle, 6);
    expect(histogramPosition(fenced, overflow?.startMs ?? 0)).toBeCloseTo(middle, 6);
  });
});
