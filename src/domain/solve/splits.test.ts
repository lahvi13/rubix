import { describe, expect, it } from 'vitest';
import type { Split } from '../../db/types';
import {
  endedInPhase,
  insertSplit,
  moveSplit,
  normaliseSplits,
  phaseDurations,
  phaseSegments,
  phaseShares,
  removeSplit,
  splitBounds,
} from './splits';

const PHASES = ['cross', 'f2l', 'oll', 'pll'];

function at(phase: string, atMs: number): Split {
  return { phase, atMs, source: 'manual' };
}

function lengths(splits: Split[], rawMs: number): (number | null)[] {
  return phaseDurations(splits, PHASES, rawMs).map((phase) => phase.ms);
}

describe('phaseDurations', () => {
  it.each<[string, Split[], number, (number | null)[]]>([
    ['nothing measured', [], 20_000, [null, null, null, null]],
    [
      'every boundary tapped; the last phase ends at the stop',
      [at('cross', 2000), at('f2l', 10_000), at('oll', 14_000)],
      20_000,
      [2000, 8000, 4000, 6000],
    ],
    [
      'a skip is a phase of zero length',
      [at('cross', 2000), at('f2l', 10_000), at('oll', 10_000)],
      14_000,
      [2000, 8000, 0, 4000],
    ],
    [
      'ended early: the phase in progress runs to the stop, later phases are absent',
      [at('cross', 2000)],
      9000,
      [2000, 7000, null, null],
    ],
    [
      'a missing boundary makes the phases on both sides unknown',
      [at('cross', 2000), at('oll', 14_000)],
      20_000,
      [2000, null, null, 6000],
    ],
    [
      'a missing first boundary only costs the first two phases',
      [at('f2l', 10_000), at('oll', 14_000)],
      20_000,
      [null, null, 4000, 6000],
    ],
  ])('%s', (_name, splits, rawMs, expected) => {
    expect(lengths(splits, rawMs)).toEqual(expected);
  });

  it('marks the phase the solve ended in and the phases it never reached', () => {
    const durations = phaseDurations([at('cross', 2000)], PHASES, 9000);
    expect(durations.map((phase) => phase.isFinal)).toEqual([false, true, false, false]);
    expect(durations.map((phase) => phase.isBeyondEnd)).toEqual([false, false, true, true]);
  });

  it('reports no phase as final when nothing was measured', () => {
    const durations = phaseDurations([], PHASES, 9000);
    expect(durations.some((phase) => phase.isFinal || phase.isBeyondEnd)).toBe(false);
  });
});

describe('endedInPhase', () => {
  it.each<[string, Split[], number | null]>([
    ['no splits', [], null],
    ['one boundary ends in the second phase', [at('cross', 1000)], 1],
    ['all interior boundaries end in the last phase', [at('cross', 1), at('f2l', 2), at('oll', 3)], 3],
    ['out of order splits still find the furthest', [at('oll', 3), at('cross', 1)], 3],
    ['a boundary on the last phase cannot push past it', [at('pll', 3)], 3],
    ['a phase the method does not have is ignored', [at('nonsense', 3)], null],
  ])('%s', (_name, splits, expected) => {
    expect(endedInPhase(splits, PHASES)).toBe(expected);
  });
});

describe('normaliseSplits', () => {
  it.each<[string, Split[], number, { phase: string; atMs: number }[]]>([
    ['empty stays empty', [], 10_000, []],
    [
      'sorts into method order',
      [at('oll', 8000), at('cross', 2000)],
      10_000,
      [
        { phase: 'cross', atMs: 2000 },
        { phase: 'oll', atMs: 8000 },
      ],
    ],
    ['drops phases the method does not have', [at('zbll', 2000)], 10_000, []],
    ['drops a boundary at or past the stop', [at('cross', 10_000)], 10_000, []],
    [
      'drops a boundary that would run backwards',
      [at('cross', 5000), at('f2l', 3000)],
      10_000,
      [{ phase: 'cross', atMs: 5000 }],
    ],
    [
      'keeps equal neighbours, which is what a skip looks like',
      [at('cross', 5000), at('f2l', 5000)],
      10_000,
      [
        { phase: 'cross', atMs: 5000 },
        { phase: 'f2l', atMs: 5000 },
      ],
    ],
    ['rounds to whole milliseconds', [at('cross', 1999.6)], 10_000, [{ phase: 'cross', atMs: 2000 }]],
    [
      'keeps only the first boundary of a repeated phase',
      [at('cross', 2000), at('cross', 3000)],
      10_000,
      [{ phase: 'cross', atMs: 2000 }],
    ],
  ])('%s', (_name, splits, rawMs, expected) => {
    expect(normaliseSplits(splits, PHASES, rawMs).map(({ phase, atMs }) => ({ phase, atMs }))).toEqual(
      expected,
    );
  });

  it('keeps the source of every split it passes through', () => {
    const [split] = normaliseSplits([{ phase: 'cross', atMs: 2000, source: 'mic' }], PHASES, 9000);
    expect(split?.source).toBe('mic');
  });
});

describe('splitBounds', () => {
  const splits = [at('cross', 2000), at('oll', 14_000)];

  it.each<[string, string, { minMs: number; maxMs: number }]>([
    ['first phase starts at zero', 'cross', { minMs: 0, maxMs: 14_000 }],
    ['a gap widens the window to the nearest known neighbours', 'f2l', { minMs: 2000, maxMs: 14_000 }],
    ['the last recorded boundary is bounded by the stop', 'oll', { minMs: 2000, maxMs: 20_000 }],
  ])('%s', (_name, phase, expected) => {
    expect(splitBounds(splits, PHASES, phase, 20_000)).toEqual(expected);
  });
});

describe('moveSplit', () => {
  const splits = [at('cross', 2000), at('f2l', 10_000)];

  it('moves a boundary inside its window', () => {
    expect(moveSplit(splits, PHASES, 'cross', 3000, 20_000)?.[0]?.atMs).toBe(3000);
  });

  it.each<[string, string, number]>([
    ['past the next boundary', 'cross', 11_000],
    ['before the previous one', 'f2l', 1000],
    ['at or past the stop', 'f2l', 20_000],
  ])('refuses a move %s', (_name, phase, atMs) => {
    expect(moveSplit(splits, PHASES, phase, atMs, 20_000)).toBeNull();
  });
});

describe('insertSplit', () => {
  it('places a missing boundary halfway through the block it splits', () => {
    const next = insertSplit([at('cross', 2000), at('oll', 14_000)], PHASES, 'f2l', 20_000);
    expect(next.map(({ phase, atMs }) => ({ phase, atMs }))).toEqual([
      { phase: 'cross', atMs: 2000 },
      { phase: 'f2l', atMs: 8000 },
      { phase: 'oll', atMs: 14_000 },
    ]);
  });

  it('marks the added boundary as entered by hand', () => {
    expect(insertSplit([], PHASES, 'cross', 20_000)[0]?.source).toBe('manual');
  });

  it('stays below the stop even in a solve too short to halve', () => {
    const [split] = insertSplit([], PHASES, 'cross', 1);
    expect(split?.atMs).toBe(0);
  });

  it('leaves an existing boundary alone', () => {
    expect(insertSplit([at('cross', 2000)], PHASES, 'cross', 20_000)).toEqual([at('cross', 2000)]);
  });
});

describe('removeSplit', () => {
  it('drops one boundary and keeps the rest', () => {
    expect(removeSplit([at('cross', 2000), at('f2l', 9000)], 'cross')).toEqual([at('f2l', 9000)]);
  });
});

describe('phaseSegments', () => {
  it('gives one segment per phase when every boundary is there', () => {
    expect(phaseSegments([at('cross', 2000), at('f2l', 10_000), at('oll', 14_000)], PHASES, 20_000)).toEqual([
      { phases: ['cross'], startMs: 0, ms: 2000 },
      { phases: ['f2l'], startMs: 2000, ms: 8000 },
      { phases: ['oll'], startMs: 10_000, ms: 4000 },
      { phases: ['pll'], startMs: 14_000, ms: 6000 },
    ]);
  });

  it('merges the phases around a missing boundary, because only their sum is known', () => {
    expect(phaseSegments([at('cross', 2000), at('oll', 14_000)], PHASES, 20_000)).toEqual([
      { phases: ['cross'], startMs: 0, ms: 2000 },
      { phases: ['f2l', 'oll'], startMs: 2000, ms: 12_000 },
      { phases: ['pll'], startMs: 14_000, ms: 6000 },
    ]);
  });

  it('stops at the phase the solve ended in', () => {
    expect(phaseSegments([at('cross', 2000)], PHASES, 9000)).toEqual([
      { phases: ['cross'], startMs: 0, ms: 2000 },
      { phases: ['f2l'], startMs: 2000, ms: 7000 },
    ]);
  });

  it('draws nothing for a solve that was not timed by phase', () => {
    expect(phaseSegments([], PHASES, 9000)).toEqual([]);
  });
});

describe('phaseShares', () => {
  const sharesOf = (splits: Split[], rawMs: number) =>
    phaseShares(phaseSegments(splits, PHASES, rawMs), rawMs);

  it.each<[string, Split[], number, number[]]>([
    [
      'a quarter each',
      [at('cross', 5000), at('f2l', 10_000), at('oll', 15_000)],
      20_000,
      [25, 25, 25, 25],
    ],
    // Three equal thirds tie on the remainder, and the spare percent goes to
    // the earliest of them.
    ['thirds still add up to a hundred', [at('cross', 10_000), at('f2l', 20_000)], 30_000, [34, 33, 33]],
    [
      'a skipped phase is worth nothing',
      [at('cross', 2000), at('f2l', 10_000), at('oll', 10_000)],
      20_000,
      [10, 40, 0, 50],
    ],
    [
      'a merged pair is one share, not two',
      [at('cross', 2000), at('oll', 14_000)],
      20_000,
      [10, 60, 30],
    ],
    [
      'the shares of a solve that ended early are of the whole solve',
      [at('cross', 2000)],
      10_000,
      [20, 80],
    ],
    // Not a solve anyone can perform, but a share of nothing must not be NaN.
    ['a solve of no length is nought per cent all the way along', [at('cross', 0)], 0, [0, 0]],
  ])('%s', (_name, splits, rawMs, expected) => {
    expect(sharesOf(splits, rawMs)).toEqual(expected);
  });

  it('is measured against the raw time, so a +2 takes nothing off any phase', () => {
    // Same splits, same rawMs: the caller never hands the penalty in, which is
    // what keeps a +2 out of the numbers.
    const splits = [at('cross', 2000), at('f2l', 10_000), at('oll', 14_000)];
    expect(sharesOf(splits, 20_000)).toEqual([10, 40, 20, 30]);
  });
});
