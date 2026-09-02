import { describe, expect, it } from 'vitest';
import {
  bestAverage,
  currentAverage,
  rollingAverage,
  trimCount,
  windowAverage,
  type Average,
} from './averages';

describe('trimCount', () => {
  it.each<[number, number]>([
    [3, 1],
    [5, 1],
    [12, 1],
    [13, 1], // ceil(13 * 0.05) = 1
    [40, 2],
    [50, 3], // ceil(2.5)
    [100, 5],
  ])('n=%i trims %i from each side', (n, expected) => {
    expect(trimCount(n)).toBe(expected);
  });
});

describe('windowAverage', () => {
  it.each<[string, (number | null)[], number | 'dnf']>([
    ['plain ao5 drops best and worst', [1000, 2000, 3000, 4000, 5000], 3000],
    ['one DNF in ao5 is trimmed as the worst', [1000, 2000, 3000, 4000, null], 3000],
    ['two DNFs in ao5 make the average DNF', [1000, 2000, 3000, null, null], 'dnf'],
    ['all DNF is DNF', [null, null, null, null, null], 'dnf'],
    ['result is rounded to whole ms', [1000, 1001, 1002, 1004, 9999], 1002],
    ['identical times average to themselves', [1500, 1500, 1500, 1500, 1500], 1500],
  ])('%s', (_name, finals, expected) => {
    expect(windowAverage(finals)).toBe(expected);
  });

  it('trims ceil(5%) from each side for n=50', () => {
    // 3 best and 3 worst must go: outliers at both ends must not move the mean.
    const finals: (number | null)[] = Array.from({ length: 50 }, () => 10_000);
    finals[0] = 1;
    finals[1] = 2;
    finals[2] = 3;
    finals[47] = 90_000;
    finals[48] = 91_000;
    finals[49] = null;
    expect(windowAverage(finals)).toBe(10_000);
  });

  it('DNFs beyond the upper trim make an ao50 DNF', () => {
    const finals: (number | null)[] = Array.from({ length: 50 }, () => 10_000);
    finals[0] = null;
    finals[1] = null;
    finals[2] = null;
    finals[3] = null; // 4 DNFs > trim of 3
    expect(windowAverage(finals)).toBe('dnf');
  });
});

describe('currentAverage', () => {
  it.each<[string, (number | null)[], number, Average]>([
    ['fewer solves than the window is null', [1000, 2000, 3000, 4000], 5, null],
    ['empty history is null', [], 5, null],
    ['uses only the last n solves', [99_000, 1000, 2000, 3000, 4000, 5000], 5, 3000],
  ])('%s', (_name, finals, n, expected) => {
    expect(currentAverage(finals, n)).toBe(expected);
  });
});

describe('bestAverage', () => {
  it('finds the best contiguous window, not the best subset', () => {
    const finals = [1000, 9000, 9000, 9000, 9000, 9000, 1000];
    // Every window contains at least three 9000s; none can average 1000-ish.
    expect(bestAverage(finals, 5)).toBe(9000);
  });

  it('skips DNF windows when a clean one exists', () => {
    const finals = [null, null, 5000, 5000, 5000, 5000, 5000];
    expect(bestAverage(finals, 5)).toBe(5000);
  });

  it('is dnf when every window is DNF', () => {
    const finals = [null, null, 1000, null, null, 1000];
    expect(bestAverage(finals, 5)).toBe('dnf');
  });

  it('is null below the window size', () => {
    expect(bestAverage([1000, 2000], 5)).toBeNull();
  });
});

describe('rollingAverage', () => {
  it('aligns one value per solve with nulls before the window fills', () => {
    const finals = [1000, 2000, 3000, 4000, 5000, 6000];
    expect(rollingAverage(finals, 5)).toEqual([null, null, null, null, 3000, 4000]);
  });

  it('turns DNF averages into gaps, while a single trimmed DNF is not one', () => {
    const finals = [null, null, 1000, 1000, 1000, 1000, 1000];
    // Index 4 still holds two DNFs -> gap; index 5 has one, which gets trimmed.
    expect(rollingAverage(finals, 5)).toEqual([null, null, null, null, null, 1000, 1000]);
  });

  it('handles an empty history', () => {
    expect(rollingAverage([], 12)).toEqual([]);
  });
});
