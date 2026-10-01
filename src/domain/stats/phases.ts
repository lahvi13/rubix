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
  /** The solve a best was set in, so the number can open it; null for an average. */
  solveId: string | null;
}

/**
 * Which solves a row covers: an aoN window, every phase-timed solve ('all'),
 * or the fastest each phase has ever been ('best').
 */
export type PhaseWindow = number | 'all' | 'best';

export interface PhaseAverageRow {
  n: PhaseWindow;
  phases: PhaseAverage[];
  totalMs: Average;
  /** The fastest solve, on the 'best' row; null on every other. */
  totalSolveId: string | null;
}

export const PHASE_AVERAGE_WINDOWS: readonly PhaseWindow[] = [...AVERAGE_WINDOWS, 'all', 'best'];

/** Solves timed by phase, chronological. Everything below works over these. */
export function measuredSolves(solves: readonly Solve[]): Solve[] {
  return solves.filter((solve) => solve.splits.length > 0);
}

export function phaseAverageTable(
  solves: readonly Solve[],
  phaseKeys: readonly string[],
): PhaseAverageRow[] {
  const measured = measuredSolves(solves);
  const lengths = lengthsBySolve(measured, phaseKeys);
  return PHASE_AVERAGE_WINDOWS.map((n) => phaseAverageRow(measured, phaseKeys, n, lengths));
}

/** A solve's phase lengths, in method order; null where a boundary is missing. */
type PhaseLengths = ReadonlyMap<Solve, readonly (number | null)[]>;

/**
 * Every phase length of every solve, worked out once. The table reads them
 * six rows by four columns over, and splitting each solve afresh for every
 * cell was most of what the stats screen spent on a session of thousands.
 */
function lengthsBySolve(solves: readonly Solve[], phaseKeys: readonly string[]): PhaseLengths {
  return new Map(
    solves.map((solve) => [
      solve,
      phaseDurations(solve.splits, phaseKeys, solve.rawMs).map((duration) => duration.ms),
    ]),
  );
}

function phaseAverageRow(
  measured: readonly Solve[],
  phaseKeys: readonly string[],
  n: PhaseWindow,
  lengths: PhaseLengths,
): PhaseAverageRow {
  const empty: PhaseAverageRow = {
    n,
    phases: phaseKeys.map((phase) => ({ phase, ms: null, count: 0, solveId: null })),
    totalMs: null,
    totalSolveId: null,
  };
  if (measured.length === 0) return empty;
  if (typeof n === 'number' && measured.length < n) return empty;

  // 'best' and 'all' both look at every phase-timed solve; only the fold differs.
  const window = typeof n === 'number' ? measured.slice(measured.length - n) : measured;
  const kept = typeof n === 'number' ? trimmed(window) : window.filter((solve) => !isDnf(solve));
  const finals = window.map(finalMs);

  if (n === 'best') {
    // The fastest cross and the fastest PLL are almost never the same solve,
    // so this row is the only one whose columns are not meant to add up.
    const fastest = fastestOf(kept, finalMs);
    return {
      n,
      phases: phaseKeys.map((phase, order) => bestOfPhase(kept, lengths, phase, order)),
      totalMs: fastest?.ms ?? null,
      totalSolveId: fastest?.solve.id ?? null,
    };
  }

  return {
    n,
    // The phases come from the same solves as the total, so with every
    // boundary recorded the columns add up to the number on the right. A
    // solve carrying a +2 is the one exception: the penalty is not part of
    // any phase.
    phases: phaseKeys.map((phase, order) => averageOfPhase(kept, lengths, phase, order)),
    totalMs: n === 'all' ? meanOf(kept.map(finalMs)) : windowAverage(finals),
    totalSolveId: null,
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
  lengths: PhaseLengths,
  phase: string,
  order: number,
): PhaseAverage {
  const known = lengthsOfPhase(solves, lengths, order);
  return { phase, ms: meanOf(known), count: known.length, solveId: null };
}

/** Known lengths of one phase across the given solves. Unknown ones are skipped. */
function lengthsOfPhase(solves: readonly Solve[], lengths: PhaseLengths, order: number): number[] {
  const known: number[] = [];
  for (const solve of solves) {
    const ms = lengths.get(solve)?.[order];
    if (ms != null) known.push(ms);
  }
  return known;
}

/**
 * A skip takes no part, by the same rule as bestsOf: an OLL of zero length
 * would otherwise stand as the best OLL of every session it is in.
 */
function bestOfPhase(
  solves: readonly Solve[],
  lengths: PhaseLengths,
  phase: string,
  order: number,
): PhaseAverage {
  const known = lengthsOfPhase(solves, lengths, order);
  const fastest = fastestOf(solves, (solve) => {
    const ms = lengths.get(solve)?.[order];
    return ms == null || ms === 0 ? null : ms;
  });
  return { phase, ms: fastest?.ms ?? null, count: known.length, solveId: fastest?.solve.id ?? null };
}

/** The solve with the least value, and the value. Ties go to the earliest — the one that set it. */
function fastestOf(
  solves: readonly Solve[],
  valueOf: (solve: Solve) => number | null,
): { solve: Solve; ms: number } | null {
  let best: { solve: Solve; ms: number } | null = null;
  for (const solve of solves) {
    const ms = valueOf(solve);
    if (ms !== null && (best === null || ms < best.ms)) best = { solve, ms };
  }
  return best;
}

function leastOf(values: readonly (number | null)[]): number | null {
  let best: number | null = null;
  for (const value of values) {
    if (value !== null && (best === null || value < best)) best = value;
  }
  return best;
}

function meanOf(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((sum, value) => sum + value, 0) / known.length);
}

/** The fastest result and the fastest each phase has been, over one set of solves. */
export interface Bests {
  /** null when the set is empty or every solve in it is a DNF. */
  totalMs: number | null;
  /** In method order; null for a phase no solve in the set measured. */
  phaseMs: (number | null)[];
}

/**
 * The bests of whatever set is handed in — the history's filtered list, not
 * the session — so that turning a filter on re-asks the question rather than
 * keeping an answer about solves that are no longer on screen.
 *
 * DNFs take no part: the cross of a solve that was never finished is not the
 * cross to beat, which is the same rule the 'best' row of the phase table
 * plays by.
 *
 * Neither does a phase of zero length. A skip is a case that did not come up,
 * not an OLL anyone solved quickly, and once one has happened it would be the
 * best OLL of every session it is in — which leaves the mark saying nothing
 * about the phase it is on.
 */
export function bestsOf(solves: readonly Solve[], phaseKeys: readonly string[]): Bests {
  const kept = measuredSolves(solves).filter((solve) => !isDnf(solve));
  const lengths = lengthsBySolve(kept, phaseKeys);
  return {
    totalMs: leastOf(solves.map(finalMs)),
    phaseMs: phaseKeys.map((_, order) =>
      leastOf(lengthsOfPhase(kept, lengths, order).filter((ms) => ms > 0)),
    ),
  };
}

/**
 * Which phases of one solve are the fastest that phase has been in the set —
 * the rule the bar marks a block by, and the rule the row asks whether it
 * holds anything worth coming back to. One function, so the mark on the row
 * and the mark on the block can never disagree.
 *
 * A phase whose boundary was never recorded has no length to compare, and a
 * DNF's phases describe a solve that did not work.
 */
export function bestPhasesIn(
  solve: Solve,
  phaseKeys: readonly string[],
  bests: Bests,
): string[] {
  if (isDnf(solve)) return [];
  return phaseDurations(solve.splits, phaseKeys, solve.rawMs)
    .filter((duration, index) => duration.ms !== null && duration.ms === bests.phaseMs[index])
    .map((duration) => duration.phase);
}

/**
 * The smoothing window. 5, not the trend chart's 12 — phase-timed solves are
 * rarer than plain ones, so the smallest standard window is the one that fills.
 */
export const PHASE_TREND_WINDOW = 5;

export interface PhaseTrendPoint {
  /**
   * 1-based position among the phase-timed solves, which is what the chart
   * counts along its x axis. It is not the solve's number in the session:
   * solves timed as a whole are not on this chart at all.
   */
  index: number;
  /** When the solve was made, so the readout can say which day it was. */
  at: number;
  /** What each phase actually took on this solve, in method order. */
  phases: number[];
  /**
   * Rolling mean of each phase over the window ending here, in method order;
   * null until the window has filled. The raw series answers "what happened",
   * this one answers "is the cross getting faster" — the chart draws whichever
   * the reader asked for, which is why both are carried.
   */
  mean: number[] | null;
}

/**
 * Only solves where EVERY phase length is known take part. A stacked chart
 * whose parts do not add up to the solve is worse than a shorter chart, and
 * a solve that ended early genuinely has no OLL to plot.
 */
export function fullyMeasuredSolves(
  solves: readonly Solve[],
  phaseKeys: readonly string[],
): { solve: Solve; lengths: number[] }[] {
  const complete: { solve: Solve; lengths: number[] }[] = [];
  for (const solve of measuredSolves(solves)) {
    if (isDnf(solve)) continue;
    const durations = phaseDurations(solve.splits, phaseKeys, solve.rawMs);
    const lengths = durations.map((duration) => duration.ms);
    if (lengths.every((ms): ms is number => ms !== null)) {
      complete.push({ solve, lengths: lengths as number[] });
    }
  }
  return complete;
}

/**
 * How long each phase takes as the session goes on — one point per phase-timed
 * solve, carrying both the raw lengths and the rolling mean.
 *
 * The index counts every such solve from 1, including the first few that have
 * no mean yet: an axis that started at 5 said nothing about the four solves
 * before it, and the reader had no way to tell that from a session whose first
 * four solves were missing.
 */
export function phaseTrend(
  solves: readonly Solve[],
  phaseKeys: readonly string[],
  limit: number,
  window: number = PHASE_TREND_WINDOW,
): PhaseTrendPoint[] {
  if (phaseKeys.length === 0) return [];
  const complete = fullyMeasuredSolves(solves, phaseKeys);

  const points: PhaseTrendPoint[] = complete.map((entry, position) => {
    const end = position + 1;
    const slice = complete.slice(Math.max(0, end - window), end);
    return {
      index: end,
      at: entry.solve.createdAt,
      phases: phaseKeys.map((_, phase) => entry.lengths[phase] ?? 0),
      mean:
        slice.length < window
          ? null
          : phaseKeys.map((_, phase) =>
              Math.round(
                slice.reduce((sum, member) => sum + (member.lengths[phase] ?? 0), 0) / window,
              ),
            ),
    };
  });

  return points.slice(Math.max(0, points.length - limit));
}
