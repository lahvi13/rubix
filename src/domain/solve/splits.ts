/**
 * Phase splits — the boundaries between the phases of one solve.
 *
 * The model, decided here and written into SPEC 3.6:
 *
 * - A split is an INTERIOR boundary. The last phase entered is closed by the
 *   solve's own rawMs, so a four-phase method stores at most three splits.
 *   Storing a split at rawMs would duplicate a number that already exists,
 *   and every later edit of rawMs would have to keep it in sync.
 * - Splits are cumulative from the start of the solve and strictly ordered:
 *   `0 <= atMs[i] <= atMs[i+1] < rawMs`. Equal neighbours are legal — that is
 *   how a skipped phase looks (OLL skip = an OLL of zero length).
 * - A MISSING boundary is not a skip, it is "not measured". Both the phase
 *   before it and the phase after it then have an unknown length; neither may
 *   be counted, because their sum is all that is known.
 * - No splits at all means the solve was not measured by phase.
 */

import type { Split } from '../../db/types';

/** A phase of the solve, in method order, with the length it took. */
export interface PhaseDuration {
  phase: string;
  /** null when the phase was never entered or one of its boundaries is unknown. */
  ms: number | null;
  /** The phase the solve ended in — its end is the stop, not a split. */
  isFinal: boolean;
  /** The solve never got this far, so there is nothing to measure or edit. */
  isBeyondEnd: boolean;
}

/**
 * Length of each phase of the method, in order. Never stored (SPEC 4.4): a
 * stored duration would go stale the moment somebody corrects the raw time.
 */
export function phaseDurations(
  splits: readonly Split[],
  phaseKeys: readonly string[],
  rawMs: number,
): PhaseDuration[] {
  const at = boundaryTimes(splits, phaseKeys);
  const endedIn = endedInPhase(splits, phaseKeys);

  return phaseKeys.map((phase, index) => {
    if (endedIn === null || index > endedIn) {
      return { phase, ms: null, isFinal: false, isBeyondEnd: endedIn !== null };
    }
    const isFinal = index === endedIn;
    const start = index === 0 ? 0 : at.get(phaseKeys[index - 1] ?? '');
    const end = isFinal ? rawMs : at.get(phase);
    const known = start !== undefined && end !== undefined && end >= start;
    return { phase, ms: known ? end - start : null, isFinal, isBeyondEnd: false };
  });
}

/**
 * Index of the phase the solve ended in: one past the last boundary recorded.
 * null when nothing was measured, which is also what a solve timed as a whole
 * looks like — there is no separate "was this a phase solve" flag, and adding
 * one would be a second source of truth for the same thing.
 */
export function endedInPhase(
  splits: readonly Split[],
  phaseKeys: readonly string[],
): number | null {
  let last = -1;
  for (const split of splits) {
    const index = phaseKeys.indexOf(split.phase);
    if (index > last) last = index;
  }
  if (last === -1) return null;
  return Math.min(last + 1, phaseKeys.length - 1);
}

function boundaryTimes(
  splits: readonly Split[],
  phaseKeys: readonly string[],
): Map<string, number> {
  const at = new Map<string, number>();
  for (const split of splits) {
    if (phaseKeys.includes(split.phase)) at.set(split.phase, split.atMs);
  }
  return at;
}

/**
 * A drawable stretch of the solve: one phase, or several when the boundary
 * between them was never recorded. Only their sum is known then, so the bar
 * has to draw them as one block rather than invent a division.
 */
export interface PhaseSegment {
  /** Phase keys covered, in method order. More than one means a missing boundary. */
  phases: string[];
  startMs: number;
  ms: number;
}

/** Segments covering the whole solve, from the start to the stop. */
export function phaseSegments(
  splits: readonly Split[],
  phaseKeys: readonly string[],
  rawMs: number,
): PhaseSegment[] {
  const endedIn = endedInPhase(splits, phaseKeys);
  if (endedIn === null) return [];

  const at = boundaryTimes(splits, phaseKeys);
  const segments: PhaseSegment[] = [];
  let pending: string[] = [];
  let startMs = 0;

  for (let index = 0; index <= endedIn; index += 1) {
    const phase = phaseKeys[index] ?? '';
    pending.push(phase);
    const end = index === endedIn ? rawMs : at.get(phase);
    if (end === undefined) continue;
    segments.push({ phases: pending, startMs, ms: Math.max(end - startMs, 0) });
    pending = [];
    startMs = end;
  }
  return segments;
}

/**
 * Splits sorted into method order and stripped of anything that cannot be
 * read back: phases the method does not have, boundaries at or past the end
 * of the solve, and times that would run backwards.
 *
 * Applied on the way into the database, so nothing downstream has to defend
 * itself against a set of splits that does not make sense.
 */
export function normaliseSplits(
  splits: readonly Split[],
  phaseKeys: readonly string[],
  rawMs: number,
): Split[] {
  const ordered = [...splits]
    .filter((split) => phaseKeys.includes(split.phase))
    .sort((a, b) => phaseKeys.indexOf(a.phase) - phaseKeys.indexOf(b.phase));

  const kept: Split[] = [];
  const seen = new Set<string>();
  let previous = 0;

  for (const split of ordered) {
    if (seen.has(split.phase)) continue;
    const atMs = Math.round(split.atMs);
    if (!Number.isFinite(atMs) || atMs < previous || atMs >= rawMs) continue;
    seen.add(split.phase);
    kept.push({ ...split, atMs });
    previous = atMs;
  }
  return kept;
}

/** The window a boundary may be moved within, so the editor can refuse the rest. */
export function splitBounds(
  splits: readonly Split[],
  phaseKeys: readonly string[],
  phase: string,
  rawMs: number,
): { minMs: number; maxMs: number } {
  const index = phaseKeys.indexOf(phase);
  const at = boundaryTimes(splits, phaseKeys);

  let minMs = 0;
  for (let i = index - 1; i >= 0; i -= 1) {
    const previous = at.get(phaseKeys[i] ?? '');
    if (previous !== undefined) {
      minMs = previous;
      break;
    }
  }

  let maxMs = rawMs;
  for (let i = index + 1; i < phaseKeys.length; i += 1) {
    const next = at.get(phaseKeys[i] ?? '');
    if (next !== undefined) {
      maxMs = next;
      break;
    }
  }
  return { minMs, maxMs };
}

/**
 * Move one boundary. Out-of-range moves are refused rather than clamped: a
 * silently clamped time is a wrong time the user was never told about.
 */
export function moveSplit(
  splits: readonly Split[],
  phaseKeys: readonly string[],
  phase: string,
  atMs: number,
  rawMs: number,
): Split[] | null {
  const { minMs, maxMs } = splitBounds(splits, phaseKeys, phase, rawMs);
  if (atMs < minMs || atMs > maxMs || atMs >= rawMs) return null;
  return splits.map((split) => (split.phase === phase ? { ...split, atMs } : split));
}

/**
 * Add the boundary of a phase that was never recorded, placed halfway through
 * the block it splits — the only guess available, and the point from which
 * dragging it either way is shortest.
 */
export function insertSplit(
  splits: readonly Split[],
  phaseKeys: readonly string[],
  phase: string,
  rawMs: number,
): Split[] {
  if (splits.some((split) => split.phase === phase)) return [...splits];
  const { minMs, maxMs } = splitBounds(splits, phaseKeys, phase, rawMs);
  const atMs = Math.min(Math.round((minMs + maxMs) / 2), rawMs - 1);
  const next: Split[] = [...splits, { phase, atMs: Math.max(atMs, minMs), source: 'manual' }];
  return next.sort((a, b) => phaseKeys.indexOf(a.phase) - phaseKeys.indexOf(b.phase));
}

export function removeSplit(splits: readonly Split[], phase: string): Split[] {
  return splits.filter((split) => split.phase !== phase);
}

/**
 * Drop the boundaries a shortened solve no longer contains. Correcting a
 * mistyped raw time must not leave a split sitting past the end of the solve,
 * and the phases it belonged to are genuinely unknown afterwards.
 */
export function clampSplitsToRaw(splits: readonly Split[], rawMs: number): Split[] {
  return splits.filter((split) => split.atMs < rawMs);
}
