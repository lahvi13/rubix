import { describe, expect, it } from 'vitest';
import {
  caseStats,
  casePace,
  slowestCases,
  type CaseAttempt,
  type CaseStats,
} from './case-stats';
import type { Penalty } from '../../db/types';

/** Attempts in the order they happened; the index doubles as the timestamp. */
function attempts(...entries: (number | [number, Penalty])[]): CaseAttempt[] {
  return entries.map((entry, index) => {
    const [rawMs, penalty] = typeof entry === 'number' ? [entry, 'none' as Penalty] : entry;
    return { rawMs, penalty, createdAt: 1000 + index };
  });
}

function stats(caseId: string, overrides: Partial<CaseStats> = {}): CaseStats {
  return {
    caseId,
    attempts: 5,
    bestMs: 1000,
    lastMs: 2000,
    lastAt: 1000,
    ao5: 2000,
    ao12: null,
    meanMs: 2000,
    dnfRate: 0,
    ...overrides,
  };
}

describe('caseStats', () => {
  it('is empty for a case nobody has drilled', () => {
    expect(caseStats('pll-t', [])).toEqual({
      caseId: 'pll-t',
      attempts: 0,
      bestMs: null,
      lastMs: null,
      lastAt: null,
      ao5: null,
      ao12: null,
      meanMs: null,
      dnfRate: null,
    });
  });

  it('counts attempts, best and last from the whole history', () => {
    const result = caseStats('pll-t', attempts(3000, 1500, 2500));
    expect(result.attempts).toBe(3);
    expect(result.bestMs).toBe(1500);
    expect(result.lastMs).toBe(2500);
    expect(result.lastAt).toBe(1002);
  });

  it('reports a DNF last attempt as no time, not as the one before it', () => {
    const result = caseStats('pll-t', attempts(3000, [2000, 'dnf']));
    expect(result.lastMs).toBeNull();
    expect(result.lastAt).toBe(1001);
  });

  it('counts the +2 in every time it uses', () => {
    const result = caseStats('pll-t', attempts([1000, 'plus2']));
    expect(result.bestMs).toBe(3000);
    expect(result.lastMs).toBe(3000);
    expect(result.meanMs).toBe(3000);
  });

  it('averages only over a full window, newest first', () => {
    const result = caseStats('pll-t', attempts(9000, 1000, 2000, 3000, 4000, 5000));
    // ao5 covers the last five: 1,2,3,4,5 -> drop 1 and 5 -> 3000.
    expect(result.ao5).toBe(3000);
    expect(result.ao12).toBeNull();
  });

  it('rates DNFs over every attempt, including them', () => {
    const result = caseStats('pll-t', attempts(1000, [2000, 'dnf'], 3000, [4000, 'dnf']));
    expect(result.dnfRate).toBe(0.5);
    expect(result.meanMs).toBe(2000);
  });
});

describe('casePace', () => {
  it.each<[string, CaseStats, number | null]>([
    ['no attempts cannot be judged', stats('a', { attempts: 0, ao5: null, meanMs: null }), null],
    ['the ao5 once there is one', stats('a', { ao5: 2500, meanMs: 9000 }), 2500],
    ['the mean until then', stats('a', { attempts: 3, ao5: null, meanMs: 4000 }), 4000],
    [
      'a DNF ao5 is the worst there is',
      stats('a', { ao5: 'dnf', meanMs: 1000 }),
      Number.POSITIVE_INFINITY,
    ],
    [
      'so is a case that has only ever DNFed',
      stats('a', { attempts: 2, ao5: null, meanMs: null }),
      Number.POSITIVE_INFINITY,
    ],
  ])('%s', (_name, input, expected) => {
    expect(casePace(input)).toBe(expected);
  });
});

describe('slowestCases', () => {
  it('puts the slowest first', () => {
    const ranked = slowestCases([
      stats('fast', { ao5: 1000 }),
      stats('slow', { ao5: 5000 }),
      stats('middle', { ao5: 3000 }),
    ]);
    expect(ranked.map((entry) => entry.caseId)).toEqual(['slow', 'middle', 'fast']);
  });

  it('leaves out cases with too little history to judge', () => {
    const ranked = slowestCases([
      stats('barely', { attempts: 2, ao5: null, meanMs: 60_000 }),
      stats('known', { ao5: 3000 }),
    ]);
    expect(ranked.map((entry) => entry.caseId)).toEqual(['known']);
  });

  it('leaves out cases nobody has drilled', () => {
    expect(slowestCases([stats('never', { attempts: 0, ao5: null, meanMs: null })])).toEqual([]);
  });

  it('suggests ten cases by default', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      stats(`case-${index}`, { ao5: 1000 + index }),
    );
    expect(slowestCases(many)).toHaveLength(10);
    expect(slowestCases(many, { limit: 3 })).toHaveLength(3);
  });

  it('orders two hopeless cases by id rather than at random', () => {
    const ranked = slowestCases([stats('b', { ao5: 'dnf' }), stats('a', { ao5: 'dnf' })]);
    expect(ranked.map((entry) => entry.caseId)).toEqual(['a', 'b']);
  });
});
