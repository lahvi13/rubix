/**
 * How the drill is going, for the screen to show while the next case waits to
 * be scrambled: the last few attempts across the set, and today's count and
 * mean. Nothing about the case on the cube — that is what is being tested.
 *
 * Nothing here is stored; it is read off the attempts like every number in
 * the trainer.
 */

import { finalMs } from '../solve/final-time';
import { currentAverage } from '../stats/averages';
import { sessionMean } from '../stats/distribution';
import type { Penalty } from '../../db/types';
import type { CaseAttempt } from './case-stats';

/** A drill attempt as it is read here: its case's attempts give it its id. */
export type RunAttempt = CaseAttempt & { id: string };

export interface RecentAttempt {
  id: string;
  caseId: string;
  /** null for a DNF. */
  finalMs: number | null;
  /** So a +2 can be written as one. */
  penalty: Penalty;
  /**
   * How far off the case's ao5 the attempt came in, from the five attempts at
   * that case before it — negative is faster. Null without five before it, or
   * where either side is a DNF: there is no gap to say.
   */
  versusAo5Ms: number | null;
}

export interface DrillRun {
  /** Newest first. */
  recent: RecentAttempt[];
  todayCount: number;
  todayMeanMs: number | null;
}

/** As many as fit under the clock on a phone without scrolling to them. */
export const RECENT_ATTEMPT_COUNT = 5;

/**
 * Each case's attempts must be oldest first, as the trainer reads them
 * everywhere. `dayStart` is when today began on the reader's clock.
 */
export function drillRun(
  attemptsByCase: ReadonlyMap<string, readonly RunAttempt[]>,
  dayStart: number,
  limit = RECENT_ATTEMPT_COUNT,
): DrillRun {
  // Run after every attempt over every attempt at the set, so the attempts
  // before one are only gathered for the few that are shown.
  const all = [...attemptsByCase].flatMap(([caseId, attempts]) =>
    attempts.map((attempt, index) => ({ caseId, attempt, index, attempts })),
  );
  all.sort((a, b) => b.attempt.createdAt - a.attempt.createdAt);

  const recent = all.slice(0, limit).map(({ caseId, attempt, index, attempts }) => {
    const time = finalMs(attempt);
    const before = attempts.slice(Math.max(0, index - 5), index);
    const ao5 = before.length < 5 ? null : currentAverage(before.map(finalMs), 5);
    return {
      id: attempt.id,
      caseId,
      finalMs: time,
      penalty: attempt.penalty,
      versusAo5Ms: time === null || ao5 === null || ao5 === 'dnf' ? null : time - ao5,
    };
  });

  const today = all.filter(({ attempt }) => attempt.createdAt >= dayStart);
  return {
    recent,
    todayCount: today.length,
    todayMeanMs: sessionMean(today.map(({ attempt }) => finalMs(attempt))),
  };
}
