import { describe, expect, it } from 'vitest';
import type { Penalty, Solve, Split } from '../../db/types';
import {
  bestPhasesIn,
  bestsOf,
  measuredSolves,
  phaseAverageTable,
  phaseTrend,
} from './phases';

const PHASES = ['cross', 'f2l', 'oll', 'pll'];

/** A solve is only its time, its penalty and its splits as far as this module cares. */
function solve(rawMs: number, splitMs: number[], penalty: Penalty = 'none'): Solve {
  const splits: Split[] = splitMs.map((atMs, index) => ({
    phase: PHASES[index] ?? '',
    atMs,
    source: 'manual',
  }));
  return { rawMs, penalty, splits } as Solve;
}

function row(solves: Solve[], n: number | 'all' | 'best') {
  const found = phaseAverageTable(solves, PHASES).find((entry) => entry.n === n);
  return {
    phases: found?.phases.map((phase) => phase.ms),
    total: found?.totalMs,
  };
}

describe('measuredSolves', () => {
  it('keeps only the solves that were timed by phase', () => {
    const timed = solve(10_000, [2000, 6000, 8000]);
    expect(measuredSolves([solve(9000, []), timed])).toEqual([timed]);
  });
});

describe('phaseAverageTable', () => {
  it('reports nothing until the window is full', () => {
    const solves = [solve(10_000, [2000, 6000, 8000])];
    expect(row(solves, 5)).toEqual({ phases: [null, null, null, null], total: null });
  });

  it('averages every phase over the solves the trim keeps, so the columns add up', () => {
    const solves = [
      solve(10_000, [1000, 5000, 7000]), // fastest, trimmed away
      solve(20_000, [2000, 10_000, 14_000]),
      solve(22_000, [3000, 11_000, 15_000]),
      solve(24_000, [4000, 12_000, 16_000]),
      solve(40_000, [9000, 20_000, 30_000]), // slowest, trimmed away
    ];
    const { phases, total } = row(solves, 5);
    expect(phases).toEqual([3000, 8000, 4000, 7000]);
    expect(total).toBe(22_000);
    expect((phases ?? []).reduce((sum, ms) => (sum ?? 0) + (ms ?? 0), 0)).toBe(total);
  });

  it('leaves a phase empty when no kept solve measured it', () => {
    const solves = Array.from({ length: 5 }, (_, index) => solve(10_000 + index, [2000]));
    expect(row(solves, 5).phases).toEqual([2000, 8002, null, null]);
  });

  it('averages a phase over the solves that do have it', () => {
    const solves = [
      solve(20_000, [2000, 10_000, 14_000]),
      solve(20_000, [4000]),
      solve(20_000, [3000, 11_000, 15_000]),
    ];
    // 'all' takes every measured solve. Only two recorded OLL; the middle one
    // finished during F2L, so its F2L runs all the way to the stop.
    expect(row(solves, 'all').phases).toEqual([3000, 10_667, 4000, 5500]);
  });

  it('leaves a DNF out of the phase columns even when the trim keeps it', () => {
    const solves = [
      solve(10_000, [1000, 5000, 7000]),
      solve(20_000, [2000, 10_000, 14_000]),
      solve(30_000, [3000, 15_000, 21_000], 'dnf'),
    ];
    const { phases, total } = row(solves, 'all');
    expect(phases).toEqual([1500, 6000, 3000, 4500]);
    expect(total).toBe(15_000);
  });

  it('reports a DNF total when the trim cannot absorb the DNFs', () => {
    const solves = [
      solve(10_000, [1000, 5000, 7000], 'dnf'),
      solve(20_000, [2000, 10_000, 14_000], 'dnf'),
      solve(22_000, [3000, 11_000, 15_000]),
      solve(24_000, [4000, 12_000, 16_000]),
      solve(26_000, [5000, 13_000, 17_000]),
    ];
    expect(row(solves, 5).total).toBe('dnf');
  });

  it('counts how many solves each phase average came from', () => {
    const solves = [solve(20_000, [2000, 10_000, 14_000]), solve(20_000, [4000])];
    const all = phaseAverageTable(solves, PHASES).find((entry) => entry.n === 'all');
    expect(all?.phases.map((phase) => phase.count)).toEqual([2, 2, 1, 1]);
  });

  it('says nothing at all when no solve was timed by phase', () => {
    const table = phaseAverageTable([solve(10_000, []), solve(11_000, [])], PHASES);
    expect(table.every((entry) => entry.totalMs === null)).toBe(true);
  });
});

describe('phaseAverageTable best row', () => {
  const solves = [
    solve(20_000, [2000, 10_000, 14_000]), // cross 2.0  f2l 8.0  oll 4.0  pll 6.0
    solve(18_000, [3000, 9000, 15_000]), //   cross 3.0  f2l 6.0  oll 6.0  pll 3.0
    solve(30_000, [1000, 12_000, 20_000], 'dnf'),
  ];

  it('takes the fastest each phase has been, whichever solve it came from', () => {
    expect(row(solves, 'best').phases).toEqual([2000, 6000, 4000, 3000]);
  });

  it('reports the best single alongside it, not the sum of the phases', () => {
    expect(row(solves, 'best').total).toBe(18_000);
  });

  it('ignores a DNF however fast its phases were', () => {
    expect(row(solves, 'best').phases?.[0]).toBe(2000);
  });

  it('says nothing without a phase-timed solve', () => {
    expect(row([solve(10_000, [])], 'best')).toEqual({
      phases: [null, null, null, null],
      total: null,
    });
  });
});

describe('phaseTrend', () => {
  /** n solves whose cross grows by a second each time; the rest stay put. */
  function improving(count: number): Solve[] {
    return Array.from({ length: count }, (_, i) =>
      solve(20_000 + i * 1000, [2000 + i * 1000, 10_000 + i * 1000, 14_000 + i * 1000]),
    );
  }

  it('gives every phase-timed solve a point, from the first one', () => {
    expect(phaseTrend(improving(4), PHASES, 100)).toHaveLength(4);
    expect(phaseTrend(improving(4), PHASES, 100).map((p) => p.index)).toEqual([1, 2, 3, 4]);
  });

  it('carries what each phase took on that solve', () => {
    const [first] = phaseTrend(improving(5), PHASES, 100);
    expect(first?.phases).toEqual([2000, 8000, 4000, 6000]);
  });

  it('has no mean until the rolling window is full', () => {
    const points = phaseTrend(improving(5), PHASES, 100);
    expect(points.slice(0, 4).map((p) => p.mean)).toEqual([null, null, null, null]);
    // Cross runs 2..6s, so the mean is 4s; the other phases never move.
    expect(points[4]?.mean).toEqual([4000, 8000, 4000, 6000]);
  });

  it('numbers the points by position, so the axis reads as solve count', () => {
    expect(phaseTrend(improving(7), PHASES, 100).map((p) => p.index)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it('keeps only the last points the chart window asks for', () => {
    expect(phaseTrend(improving(10), PHASES, 2).map((p) => p.index)).toEqual([9, 10]);
  });

  it('skips solves that did not measure every phase, so the parts add up', () => {
    const mixed = [...improving(5), solve(20_000, [2000]), ...improving(5)];
    for (const point of phaseTrend(mixed, PHASES, 100)) {
      const sum = point.phases.reduce((total, ms) => total + ms, 0);
      expect(sum).toBeGreaterThan(0);
    }
    // Ten complete solves; the incomplete one is not one of them.
    expect(phaseTrend(mixed, PHASES, 100)).toHaveLength(10);
  });

  it('skips a DNF, whose phases describe a solve that did not work', () => {
    const withDnf = [...improving(5), solve(20_000, [2000, 10_000, 14_000], 'dnf')];
    expect(phaseTrend(withDnf, PHASES, 100)).toHaveLength(5);
  });

  it('draws nothing for a method with no phases', () => {
    expect(phaseTrend(improving(10), [], 100)).toEqual([]);
  });
});

describe('bestsOf', () => {
  it('finds the fastest result and the fastest each phase has been', () => {
    const solves = [
      solve(20_000, [2000, 10_000, 14_000]), // cross 2.0, f2l 8.0, oll 4.0, pll 6.0
      solve(18_000, [3000, 9000, 15_000]), //  cross 3.0, f2l 6.0, oll 6.0, pll 3.0
    ];
    expect(bestsOf(solves, PHASES)).toEqual({
      totalMs: 18_000,
      phaseMs: [2000, 6000, 4000, 3000],
    });
  });

  it('counts a +2 towards the result, because that is the result', () => {
    const solves = [solve(20_000, []), solve(19_000, [], 'plus2')];
    expect(bestsOf(solves, PHASES).totalMs).toBe(20_000);
  });

  it('leaves a DNF out of both, however fast it was', () => {
    const solves = [
      solve(20_000, [2000, 10_000, 14_000]),
      solve(5000, [500, 2000, 3000], 'dnf'),
    ];
    expect(bestsOf(solves, PHASES)).toEqual({
      totalMs: 20_000,
      phaseMs: [2000, 8000, 4000, 6000],
    });
  });

  it('leaves a skipped phase out, because a skip is not a phase anyone solved', () => {
    const solves = [
      solve(20_000, [2000, 10_000, 14_000]), // oll 4.0
      solve(18_000, [2000, 12_000, 12_000]), // oll skipped
    ];
    expect(bestsOf(solves, PHASES).phaseMs[2]).toBe(4000);
  });

  it('reports nothing for a phase every solve skipped', () => {
    expect(bestsOf([solve(18_000, [2000, 12_000, 12_000])], PHASES).phaseMs[2]).toBeNull();
  });

  it('reports nothing for a phase no solve measured', () => {
    // Only the cross boundary was tapped, so f2l and oll are one unknown pair.
    expect(bestsOf([solve(20_000, [2000])], PHASES).phaseMs).toEqual([2000, 18_000, null, null]);
  });

  it('reports nothing at all for an empty set', () => {
    expect(bestsOf([], PHASES)).toEqual({ totalMs: null, phaseMs: [null, null, null, null] });
  });
});

describe('bestPhasesIn', () => {
  const fast = solve(20_000, [2000, 10_000, 14_000]); // cross 2.0, f2l 8.0, oll 4.0, pll 6.0
  const slow = solve(18_000, [3000, 9000, 15_000]); //  cross 3.0, f2l 6.0, oll 6.0, pll 3.0
  const bests = bestsOf([fast, slow], PHASES);

  it('names the phases of this solve that are the best of the set', () => {
    expect(bestPhasesIn(fast, PHASES, bests)).toEqual(['cross', 'oll']);
    expect(bestPhasesIn(slow, PHASES, bests)).toEqual(['f2l', 'pll']);
  });

  it('names both when two solves tie on a phase', () => {
    const twin = solve(30_000, [2000, 20_000, 26_000]); // cross 2.0, same as fast
    const tied = bestsOf([fast, twin], PHASES);
    expect(bestPhasesIn(twin, PHASES, tied)).toContain('cross');
    expect(bestPhasesIn(fast, PHASES, tied)).toContain('cross');
  });

  it('names nothing for a DNF, whose phases describe a solve that did not work', () => {
    const dnf = solve(5000, [500, 2000, 3000], 'dnf');
    expect(bestPhasesIn(dnf, PHASES, bestsOf([fast, dnf], PHASES))).toEqual([]);
  });

  it('skips a phase whose boundary was never recorded, having no length to compare', () => {
    // Only the cross was tapped, so f2l onwards is one unknown stretch.
    const partial = solve(20_000, [2000]);
    expect(bestPhasesIn(partial, PHASES, bestsOf([fast, partial], PHASES))).toEqual(['cross']);
  });
});
