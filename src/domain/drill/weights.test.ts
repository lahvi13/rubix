import { describe, expect, it } from 'vitest';
import type { CaseStats } from './case-stats';
import { caseWeights, MAX_WEIGHT, MIN_WEIGHT, NEW_CASE_WEIGHT } from './weights';

function stats(caseId: string, attempts: number, ao5: CaseStats['ao5'], meanMs: number | null = null): CaseStats {
  return {
    caseId,
    attempts,
    bestMs: null,
    lastMs: null,
    lastAt: null,
    ao5,
    ao12: null,
    meanMs,
    dnfRate: null,
  };
}

function weightsOf(entries: CaseStats[], extraIds: string[] = []): Record<string, number> {
  const ids = [...entries.map((entry) => entry.caseId), ...extraIds];
  const map = new Map(entries.map((entry) => [entry.caseId, entry]));
  return Object.fromEntries(caseWeights(ids, map));
}

describe('caseWeights', () => {
  it('draws everything evenly while the numbers are still loading', () => {
    expect(Object.fromEntries(caseWeights(['a', 'b'], undefined))).toEqual({ a: 1, b: 1 });
  });

  it('draws everything evenly while no case has a pace to compare', () => {
    expect(weightsOf([stats('a', 1, null, 3000)], ['b'])).toEqual({ a: 1, b: 1 });
  });

  it('weighs by pace against the middle of the pool, squared', () => {
    const weights = weightsOf([
      stats('fast', 5, 1600),
      stats('middle', 5, 2000),
      stats('slow', 5, 3000),
    ]);
    expect(weights.middle).toBe(1);
    expect(weights.fast).toBeCloseTo(0.64);
    expect(weights.slow).toBeCloseTo(2.25);
  });

  it.each<[string, CaseStats, number]>([
    ['a case that only DNFs', stats('x', 5, 'dnf'), MAX_WEIGHT],
    ['a case far slower than the rest', stats('x', 5, 20_000), MAX_WEIGHT],
    ['a case far faster than the rest', stats('x', 5, 100), MIN_WEIGHT],
    ['a case with too few attempts for a pace', stats('x', 2, null, 9000), NEW_CASE_WEIGHT],
  ])('bounds %s', (_name, entry, expected) => {
    const weights = weightsOf([stats('a', 5, 2000), stats('b', 5, 2000), entry]);
    expect(weights.x).toBe(expected);
  });

  it('draws a case never attempted as though it were slow', () => {
    expect(weightsOf([stats('a', 5, 2000)], ['new']).new).toBe(NEW_CASE_WEIGHT);
  });

  it('takes the middle of an even pool as the mean of its two middle paces', () => {
    const weights = weightsOf([stats('a', 5, 1000), stats('b', 5, 3000)]);
    // Middle 2000: a is at half pace, a quarter squared, held up at the floor.
    expect(weights.a).toBe(MIN_WEIGHT);
    expect(weights.b).toBeCloseTo(2.25);
  });
});
