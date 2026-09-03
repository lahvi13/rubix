/**
 * Average length of each phase over a session — the table that says which
 * part of the solve is the slow one.
 *
 * Only solves that were actually timed by phase take part. A session almost
 * always mixes them with plain ones, and a window over all solves would be
 * empty nearly every time.
 */

import type { Solve } from '../../db/types';
import { finalMs, isDnf } from '../solve/final-time';
import { phaseDurations } from '../solve/splits';
import { AVERAGE_WINDOWS, trimCount, windowAverage, type Average } from './averages';

export interface PhaseAverage {
  phase: string;
  ms: number | null;
  /** How many solves of the window this came from — fewer than the window is a hint, not a lie. */
  count: number;
}

export interface PhaseAverageRow {
  /** 'all' is every phase-timed solve of the session, untrimmed. */
  n: number | 'all';
  phases: PhaseAverage[];
  totalMs: Average;
}

export const PHASE_AVERAGE_WINDOWS: readonly (number | 'all')[] = [...AVERAGE_WINDOWS, 'all'];

/** Solves timed by phase, chronological. Everything below works over these. */
export function measuredSolves(solves: readonly Solve[]): Solve[] {
  return solves.filter((solve) => solve.splits.length > 0);
}

export function phaseAverageTable(
  solves: readonly Solve[],
  phaseKeys: readonly string[],
): PhaseAverageRow[] {
  const measured = measuredSolves(solves);
  return PHASE_AVERAGE_WINDOWS.map((n) => phaseAverageRow(measured, phaseKeys, n));
}

function phaseAverageRow(
  measured: readonly Solve[],
  phaseKeys: readonly string[],
  n: number | 'all',
): PhaseAverageRow {
  const empty: PhaseAverageRow = {
    n,
    phases: phaseKeys.map((phase) => ({ phase, ms: null, count: 0 })),
    totalMs: null,
  };
  if (measured.length === 0) return empty;
  if (n !== 'all' && measured.length < n) return empty;

  const window = n === 'all' ? measured : measured.slice(measured.length - n);
  const kept = n === 'all' ? window.filter((solve) => !isDnf(solve)) : trimmed(window);
  const finals = window.map(finalMs);

  return {
    n,
    // The phases come from the same solves as the total, so with every
    // boundary recorded the columns add up to the number on the right. A
    // solve carrying a +2 is the one exception: the penalty is not part of
    // any phase.
    phases: phaseKeys.map((phase) => averageOfPhase(kept, phaseKeys, phase)),
    totalMs: n === 'all' ? meanOf(kept.map(finalMs)) : windowAverage(finals),
  };
}

/** The solves an aoN actually averages: the window minus the trim at each end. */
function trimmed(window: readonly Solve[]): Solve[] {
  const trim = trimCount(window.length);
  return [...window]
    .sort((a, b) => (finalMs(a) ?? Number.POSITIVE_INFINITY) - (finalMs(b) ?? Number.POSITIVE_INFINITY))
    .slice(trim, window.length - trim)
    .filter((solve) => !isDnf(solve));
}

function averageOfPhase(
  solves: readonly Solve[],
  phaseKeys: readonly string[],
  phase: string,
): PhaseAverage {
  const lengths: number[] = [];
  for (const solve of solves) {
    const duration = phaseDurations(solve.splits, phaseKeys, solve.rawMs).find(
      (entry) => entry.phase === phase,
    );
    if (duration?.ms != null) lengths.push(duration.ms);
  }
  return { phase, ms: meanOf(lengths), count: lengths.length };
}

function meanOf(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
}
