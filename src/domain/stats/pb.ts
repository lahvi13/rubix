/**
 * Personal bests. Best averages live in averages.ts (bestAverage); this is
 * just the single, kept separate because the single is the one statistic the
 * app also computes globally per puzzle, not per session.
 */
export function pbSingle(finals: readonly (number | null)[]): number | null {
  let best: number | null = null;
  for (const value of finals) {
    if (value !== null && (best === null || value < best)) best = value;
  }
  return best;
}
