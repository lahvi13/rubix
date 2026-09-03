/**
 * Per-case statistics for the trainer. Same rules as the session statistics
 * (SPEC 3.4) applied to the attempts of one algorithm case, plus the one thing
 * only the trainer asks for: which cases are worth practising.
 *
 * Nothing here is stored — a case's numbers change with every penalty edit.
 */

import type { Solve } from '../../db/types';
import { finalMs } from '../solve/final-time';
import { currentAverage, type Average } from '../stats/averages';
import { penaltyRate, sessionMean } from '../stats/distribution';
import { pbSingle } from '../stats/pb';

/** The part of a drill solve that counts towards a case's statistics. */
export type CaseAttempt = Pick<Solve, 'rawMs' | 'penalty' | 'createdAt'>;

export interface CaseStats {
  caseId: string;
  attempts: number;
  bestMs: number | null;
  /** Final time of the newest attempt; null when that attempt was a DNF. */
  lastMs: number | null;
  /** When the newest attempt happened, so a screen can say how stale this is. */
  lastAt: number | null;
  ao5: Average;
  ao12: Average;
  meanMs: number | null;
  dnfRate: number | null;
}

/** How many attempts before a case's pace means anything. */
export const MIN_RANKED_ATTEMPTS = 3;

/** How many cases the trainer suggests practising. */
export const SLOWEST_CASE_COUNT = 10;

/** Attempts must be chronological, oldest first — every average is a window. */
export function caseStats(caseId: string, attempts: readonly CaseAttempt[]): CaseStats {
  const finals = attempts.map(finalMs);
  const last = attempts[attempts.length - 1];

  return {
    caseId,
    attempts: attempts.length,
    bestMs: pbSingle(finals),
    lastMs: last === undefined ? null : finalMs(last),
    lastAt: last?.createdAt ?? null,
    ao5: currentAverage(finals, 5),
    ao12: currentAverage(finals, 12),
    meanMs: sessionMean(finals),
    dnfRate: penaltyRate(attempts, 'dnf'),
  };
}

/**
 * The one number a case is ranked by. The ao5 once there is one, because a
 * single slow attempt is a dropped cube rather than a case you do not know;
 * the mean until then. A case that only ever DNFs is the worst there is, not
 * an unranked one.
 *
 * null means there is nothing to judge — no attempts at all.
 */
export function casePace(stats: CaseStats): number | null {
  if (stats.attempts === 0) return null;
  if (stats.ao5 === 'dnf') return Number.POSITIVE_INFINITY;
  if (stats.ao5 !== null) return stats.ao5;
  return stats.meanMs ?? Number.POSITIVE_INFINITY;
}

export interface SlowestOptions {
  limit?: number;
  minAttempts?: number;
}

/**
 * The cases to practise: slowest first. Cases nobody has drilled yet are left
 * out rather than ranked worst — "you have never tried it" is a different
 * suggestion from "you are slow at it", and a fresh set would otherwise fill
 * the list with all 57.
 */
export function slowestCases(
  stats: readonly CaseStats[],
  options: SlowestOptions = {},
): CaseStats[] {
  const limit = options.limit ?? SLOWEST_CASE_COUNT;
  const minAttempts = options.minAttempts ?? MIN_RANKED_ATTEMPTS;

  return stats
    .filter((entry) => entry.attempts >= minAttempts && casePace(entry) !== null)
    .sort((a, b) => {
      const difference = (casePace(b) ?? 0) - (casePace(a) ?? 0);
      // Two cases that only ever DNF subtract to NaN; fall through to the id
      // so the list is at least stable.
      if (difference !== 0 && !Number.isNaN(difference)) return difference;
      return a.caseId < b.caseId ? -1 : 1;
    })
    .slice(0, limit);
}
