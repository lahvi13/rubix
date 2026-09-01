import { describe, expect, it } from 'vitest';
import type { Penalty } from '../../db/types';
import { finalMs, isDnf } from './final-time';

describe('finalMs', () => {
  it.each<[Penalty, number, number | null]>([
    ['none', 12_340, 12_340],
    ['plus2', 12_340, 14_340],
    ['dnf', 12_340, null],
    ['plus2', 0, 2000],
  ])('%s penalty on %ims yields %s', (penalty, rawMs, expected) => {
    expect(finalMs({ rawMs, penalty })).toBe(expected);
  });

  it('never mutates the raw time', () => {
    const solve = { rawMs: 9999, penalty: 'plus2' as const };
    finalMs(solve);
    expect(solve.rawMs).toBe(9999);
  });
});

describe('isDnf', () => {
  it('is true only for the dnf penalty', () => {
    expect(isDnf({ rawMs: 1, penalty: 'dnf' })).toBe(true);
    expect(isDnf({ rawMs: 1, penalty: 'plus2' })).toBe(false);
    expect(isDnf({ rawMs: 1, penalty: 'none' })).toBe(false);
  });
});
