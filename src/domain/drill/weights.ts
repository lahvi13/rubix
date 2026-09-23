import { casePace, MIN_RANKED_ATTEMPTS, type CaseStats } from './case-stats';

/** How often a case nobody has a pace for yet comes up, against a typical one. */
export const NEW_CASE_WEIGHT = 2;
/** The slowest a case can be drawn — the fastest still come round. */
export const MIN_WEIGHT = 0.5;
/** And the most — a case that keeps failing must not take the drill over. */
export const MAX_WEIGHT = 3;

/**
 * How often each case of the pool should come up, against a typical one at 1.
 *
 * A drill spent evenly is spent mostly on cases that are already fine. A case
 * is weighed by its pace against the middle of the pool, squared, so the gap
 * is felt: half as slow again comes up about twice as often, a fifth faster
 * about two thirds as often. DNFs count as slower than any time, the way the
 * pace already counts them. A case with too few attempts to have a pace is
 * drawn as though it were slow — it is the one that most needs attempts.
 *
 * Everything at 1 while nothing in the pool has a pace to compare with.
 */
export function caseWeights(
  caseIds: readonly string[],
  stats: ReadonlyMap<string, CaseStats> | undefined,
): Map<string, number> {
  const paces = new Map<string, number>();
  for (const id of caseIds) {
    const entry = stats?.get(id);
    if (entry === undefined || entry.attempts < MIN_RANKED_ATTEMPTS) continue;
    const pace = casePace(entry);
    if (pace !== null) paces.set(id, pace);
  }

  const middle = median([...paces.values()].filter((pace) => Number.isFinite(pace) && pace > 0));
  const weights = new Map<string, number>();
  for (const id of caseIds) {
    const pace = paces.get(id);
    if (middle === null) weights.set(id, 1);
    else if (pace === undefined) weights.set(id, NEW_CASE_WEIGHT);
    else weights.set(id, clamp((pace / middle) ** 2, MIN_WEIGHT, MAX_WEIGHT));
  }
  return weights;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  const upper = sorted[half] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[half - 1] ?? upper) + upper) / 2;
}

function clamp(value: number, low: number, high: number): number {
  // An endless pace over a finite middle is Infinity, which the upper bound
  // takes; NaN cannot arise, since the middle is positive and finite.
  return Math.min(high, Math.max(low, value));
}
