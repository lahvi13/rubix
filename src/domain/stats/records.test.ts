import { describe, expect, it } from 'vitest';
import type { Penalty, Solve, Split } from '../../db/types';
import { bestsOf } from './phases';
import { resultRecord } from './records';

const PHASES = ['cross', 'f2l', 'oll', 'pll'];

/** A solve is only its time, its penalty and its splits as far as this module cares. */
function solve(rawMs: number, splitMs: number[] = [], penalty: Penalty = 'none'): Solve {
  const splits: Split[] = splitMs.map((atMs, index) => ({
    phase: PHASES[index] ?? '',
    atMs,
    source: 'manual',
  }));
  return { rawMs, penalty, splits } as Solve;
}

/** The bests as the app reads them: over a session that already holds the solve. */
function recordOf(session: Solve[], globalPbMs: number | null = null) {
  const landed = session[session.length - 1];
  if (landed === undefined) throw new Error('a session with nothing in it has nothing to land');
  return resultRecord(landed, PHASES, bestsOf(session, PHASES), globalPbMs);
}

describe('resultRecord', () => {
  it('calls the fastest single anywhere a personal best', () => {
    expect(recordOf([solve(12_000), solve(9000)], 9000)).toEqual({ kind: 'pb' });
  });

  it('prefers the personal best to the session best it also is', () => {
    // The same solve holds both; only the bigger of the two is worth saying.
    expect(recordOf([solve(9000)], 9000)).toEqual({ kind: 'pb' });
  });

  it('calls the fastest of this session a session best when another session is faster', () => {
    expect(recordOf([solve(12_000), solve(10_000)], 8000)).toEqual({ kind: 'session' });
  });

  it('counts a time that matches the record rather than beating it', () => {
    expect(recordOf([solve(9000), solve(9000)], 9000)).toEqual({ kind: 'pb' });
  });

  it('says nothing about a solve that beat nothing', () => {
    expect(recordOf([solve(9000), solve(12_000)], 9000)).toBeNull();
  });

  it('names the phases when the solve holds one but not the time', () => {
    const record = recordOf(
      [
        solve(10_000, [2000, 6000, 8000]),
        // Slower overall, but the fastest cross and the fastest OLL of the two.
        solve(11_000, [1500, 6000, 7500]),
      ],
      5000,
    );
    expect(record).toEqual({ kind: 'phase', phases: ['cross', 'oll'] });
  });

  it('prefers the time to the phases it also holds', () => {
    const record = recordOf([solve(10_000, [2000, 6000, 8000]), solve(8000, [1500, 5000, 7000])]);
    expect(record).toEqual({ kind: 'session' });
  });

  it('gives a DNF nothing, however fast its phases were', () => {
    const session = [solve(20_000, [5000, 12_000, 15_000]), solve(8000, [1000, 4000, 6000], 'dnf')];
    expect(recordOf(session)).toBeNull();
  });

  it('reads a +2 by the time it is judged on', () => {
    // 9.00 raw plus two is 11.00, which loses to the 10.00 before it.
    expect(recordOf([solve(10_000), solve(9000, [], 'plus2')], 10_000)).toBeNull();
  });

  it('has nothing to say about a session of one DNF', () => {
    expect(recordOf([solve(9000, [], 'dnf')], null)).toBeNull();
  });
});
