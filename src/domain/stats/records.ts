/**
 * What the solve that just landed turned out to be worth.
 *
 * One record at a time, and the biggest one: a solve that is a personal best
 * is also the best of its session and very likely holds a phase or two, and
 * saying all of it at once is three lines nobody reads with a cube still in
 * hand. Which phases were best is drawn on the bar underneath, so the line
 * only has to name them when there is nothing bigger to say.
 */

import type { Solve } from '../../db/types';
import { finalMs, isDnf } from '../solve/final-time';
import { beatsGoal } from './distribution';
import { bestPhasesIn, type Bests } from './phases';

export type ResultRecord =
  /** The fastest single of this puzzle anywhere, this session or another. */
  | { kind: 'pb' }
  | { kind: 'session' }
  /** Phase keys, in method order; never empty. */
  | { kind: 'phase'; phases: string[] };

/**
 * `bests` and `globalPbMs` are read over sets that already contain this solve,
 * which is what makes equality the test: a solve that has just become the
 * record IS the record, rather than being faster than it.
 *
 * Ties count, the same way the star in the lists counts them — matching the
 * best you have ever done is the thing that happened, and a mark that appears
 * only on a strictly faster time would go quiet exactly when a plateau makes
 * it worth having.
 *
 * A DNF holds nothing. Neither its time nor its phases describe a solve.
 */
export function resultRecord(
  solve: Solve,
  phaseKeys: readonly string[],
  bests: Bests,
  globalPbMs: number | null,
): ResultRecord | null {
  if (isDnf(solve)) return null;

  const resultMs = finalMs(solve);
  if (resultMs !== null) {
    if (globalPbMs !== null && resultMs === globalPbMs) return { kind: 'pb' };
    if (bests.totalMs !== null && resultMs === bests.totalMs) return { kind: 'session' };
  }

  const phases = bestPhasesIn(solve, phaseKeys, bests);
  return phases.length === 0 ? null : { kind: 'phase', phases };
}

/** A record, or failing one, the goal the time beat. */
export type ResultNote = ResultRecord | { kind: 'goal'; goalMs: number };

/**
 * What to say under a finished time: its record if it holds one, and only
 * otherwise that it beat the goal. A goal within reach is beaten often — that
 * is what chasing one looks like — so it must never talk over the rarer thing,
 * and a personal best that is also under the goal is a personal best.
 *
 * `goalMs` is null while no goal is set. Judged on the final time, by the rule
 * the stats screen counts with (`beatsGoal`), so a +2 can cost it and a DNF
 * never has it.
 */
export function resultNote(
  solve: Solve,
  phaseKeys: readonly string[],
  bests: Bests,
  globalPbMs: number | null,
  goalMs: number | null,
): ResultNote | null {
  const record = resultRecord(solve, phaseKeys, bests, globalPbMs);
  if (record !== null) return record;
  return goalMs !== null && beatsGoal(finalMs(solve), goalMs) ? { kind: 'goal', goalMs } : null;
}
