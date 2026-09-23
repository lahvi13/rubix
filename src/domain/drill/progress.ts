import type { CaseProgress } from '../../db/types';

export type ProgressCounts = Record<CaseProgress, number> & { total: number };

/** How many cases of a set are at each step — the set's progress at a glance. */
export function countProgress(progress: readonly CaseProgress[]): ProgressCounts {
  const counts: ProgressCounts = { new: 0, learning: 0, known: 0, total: progress.length };
  for (const step of progress) counts[step] += 1;
  return counts;
}
