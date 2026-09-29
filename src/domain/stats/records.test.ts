import { describe, expect, it } from 'vitest';
import type { Penalty, Solve, Split } from '../../db/types';
import { bestsOf } from './phases';
import {
  challengeOutcome,
  resultNote,
  resultRecord,
  type Challenge,
  type ChallengeOutcome,
} from './records';

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

/** The note for the last solve of a session, with a goal of 15.00 unless told otherwise. */
function noteOf(session: Solve[], globalPbMs: number | null, goalMs: number | null = 15_000) {
  const landed = session[session.length - 1];
  if (landed === undefined) throw new Error('a session with nothing in it has nothing to land');
  return resultNote(landed, PHASES, bestsOf(session, PHASES), globalPbMs, goalMs);
}

describe('resultNote', () => {
  it('names the goal when the time beat it and holds no record', () => {
    expect(noteOf([solve(12_000), solve(14_000)], 12_000)).toEqual({ kind: 'goal', goalMs: 15_000 });
  });

  it.each<[string, Solve[], number | null, string]>([
    ['a personal best', [solve(14_000), solve(12_000)], 12_000, 'pb'],
    ['a session best', [solve(14_000), solve(13_000)], 9000, 'session'],
    [
      'a best phase',
      [solve(12_000, [2000, 6000, 9000]), solve(14_000, [1500, 7000, 10_000])],
      9000,
      'phase',
    ],
  ])('lets %s speak over a beaten goal', (_, session, globalPbMs, kind) => {
    expect(noteOf(session, globalPbMs)?.kind).toBe(kind);
  });

  it.each<[string, Solve, string | null]>([
    ['a time equal to the goal has not beaten it', solve(15_000), null],
    ['a +2 is judged on the time with the two seconds in it', solve(14_000, [], 'plus2'), null],
    ['a DNF never beats it', solve(14_000, [], 'dnf'), null],
  ])('%s', (_, landed, expected) => {
    expect(noteOf([solve(10_000), landed], 10_000)?.kind ?? null).toBe(expected);
  });

  it('says nothing about a goal that is not set', () => {
    expect(noteOf([solve(12_000), solve(14_000)], 12_000, null)).toBeNull();
  });

  it('answers a time to beat over a session best and a goal', () => {
    const session = [solve(14_000), solve(13_000)];
    const landed = session[1] ?? solve(0);
    expect(resultNote(landed, PHASES, bestsOf(session, PHASES), 9000, 15_000, single(13_500))).toEqual({
      kind: 'challenge',
      count: 1,
      targetMs: 13_500,
      outcome: { kind: 'beaten', marginMs: 500 },
    });
  });

  it('lets a personal best speak over a time to beat', () => {
    const session = [solve(14_000), solve(12_000)];
    const landed = session[1] ?? solve(0);
    expect(resultNote(landed, PHASES, bestsOf(session, PHASES), 12_000, null, single(13_000))).toEqual({
      kind: 'pb',
    });
  });

  it('answers a time to beat for a DNF too', () => {
    const landed = solve(9000, [], 'dnf');
    expect(resultNote(landed, PHASES, bestsOf([landed], PHASES), null, null, single(13_000))).toEqual({
      kind: 'challenge',
      count: 1,
      targetMs: 13_000,
      outcome: { kind: 'missed', marginMs: null },
    });
  });
});

const single = (targetMs: number): Challenge => ({ targetMs, count: 1, earlierMs: [] });

describe('resultNote for a shared average', () => {
  // 11.00, 12.00, 13.00, 14.00 before; the trim cuts the best and the worst.
  const earlierMs = [11_000, 12_000, 13_000, 14_000];
  const ao5 = (targetMs: number, earlier: (number | null)[] = earlierMs): Challenge => ({
    targetMs,
    count: 5,
    earlierMs: earlier,
  });

  it('answers on the last solve, with the average of all five', () => {
    // 12.00, 13.00, 14.00 kept: 13.00 against 13.50.
    const landed = solve(15_000);
    expect(resultNote(landed, PHASES, bestsOf([landed], PHASES), null, null, ao5(13_500))).toEqual({
      kind: 'challenge',
      count: 5,
      targetMs: 13_500,
      outcome: { kind: 'beaten', marginMs: 500 },
    });
  });

  it('answers over a personal best on the last solve', () => {
    const landed = solve(9000);
    expect(resultNote(landed, PHASES, bestsOf([landed], PHASES), 9000, null, ao5(12_000))?.kind).toBe(
      'challenge',
    );
  });

  it('counts a second DNF as a DNF average', () => {
    const landed = solve(9000, [], 'dnf');
    const note = resultNote(landed, PHASES, bestsOf([landed], PHASES), null, null, ao5(13_000, [11_000, null, 12_000, 13_000]));
    expect(note).toEqual({ kind: 'challenge', count: 5, targetMs: 13_000, outcome: { kind: 'missed', marginMs: null } });
  });

  it('lets the solves before the last speak as any other', () => {
    const session = [solve(14_000), solve(12_000)];
    const landed = session[1] ?? solve(0);
    const challenge = ao5(13_000, [14_000]);
    expect(resultNote(landed, PHASES, bestsOf(session, PHASES), 9000, null, challenge)).toEqual({
      kind: 'session',
    });
  });
});

describe('challengeOutcome', () => {
  it.each<[string, number | null, number, ChallengeOutcome]>([
    ['beaten', 12_340, 14_370, { kind: 'beaten', marginMs: 2030 }],
    ['beaten by a hundredth', 14_369, 14_370, { kind: 'beaten', marginMs: 10 }],
    ['tied to the hundredth', 14_378, 14_370, { kind: 'tied' }],
    ['tied though some milliseconds faster', 14_372, 14_378, { kind: 'tied' }],
    ['missed', 15_000, 14_370, { kind: 'missed', marginMs: 630 }],
    ['missed by a DNF', null, 14_370, { kind: 'missed', marginMs: null }],
  ])('%s', (_, resultMs, targetMs, outcome) => {
    expect(challengeOutcome(resultMs, targetMs)).toEqual(outcome);
  });
});
