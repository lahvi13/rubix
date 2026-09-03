import { describe, expect, it } from 'vitest';
import type { Penalty, Solve, Split } from '../../db/types';
import { measuredSolves, phaseAverageTable } from './phases';

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

function row(solves: Solve[], n: number | 'all') {
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
