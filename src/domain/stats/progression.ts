/**
 * When a record fell, and by how much — the history of a best rather than
 * only where it stands today.
 */

export interface RecordStep {
  /** Position in the series that set it, counting from zero. */
  index: number;
  ms: number;
  /** The record it beat; null for the first value there ever was. */
  previousMs: number | null;
}

/**
 * Every value that was faster than everything before it, oldest first. A tie
 * is not a record falling: the stars in the lists count one, but a history
 * where the same number appears twice says that something changed when it
 * did not. null is a DNF, or an average with no value yet, and sets nothing.
 */
export function recordProgression(values: readonly (number | null)[]): RecordStep[] {
  const steps: RecordStep[] = [];
  let bestMs: number | null = null;
  values.forEach((ms, index) => {
    if (ms === null || (bestMs !== null && ms >= bestMs)) return;
    steps.push({ index, ms, previousMs: bestMs });
    bestMs = ms;
  });
  return steps;
}
