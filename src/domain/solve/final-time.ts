import type { Penalty, Solve } from '../../db/types';

export const PLUS_TWO_MS = 2000;

/** The subset of a solve that determines its result. */
export type Timed = Pick<Solve, 'rawMs' | 'penalty'>;

export function isDnf(solve: Timed): boolean {
  return solve.penalty === 'dnf';
}

/**
 * The time that counts. Never stored — a stored final time would silently go
 * stale the moment someone edits the penalty.
 *
 * Returns null for a DNF, which is what every average calculation treats as
 * "worse than any number".
 */
export function finalMs(solve: Timed): number | null {
  if (solve.penalty === 'dnf') return null;
  if (solve.penalty === 'plus2') return solve.rawMs + PLUS_TWO_MS;
  return solve.rawMs;
}

export function penaltyLabel(penalty: Penalty): string {
  if (penalty === 'plus2') return '+2';
  if (penalty === 'dnf') return 'DNF';
  return '';
}
