import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAttemptsByCase } from '../../../db/repositories/drill-repository';
import type { Solve } from '../../../db/types';
import { listRecognitionsByCase } from '../../../db/repositories/recognition-repository';
import { caseStats, type CaseStats } from '../../../domain/drill/case-stats';

/**
 * Drill statistics for a list of cases, live. Undefined until the database
 * answers: an empty map reads as "never drilled", which is a different thing
 * to show than "not loaded yet".
 */
export function useCaseStats(caseIds: readonly string[]): Map<string, CaseStats> | undefined {
  return useStatsOf(useAttemptsByCase(caseIds));
}

/**
 * The drill attempts at a list of cases, live, oldest first per case — what
 * the statistics are counted from, for a screen that needs the attempts
 * themselves as well and should not ask the database twice.
 */
export function useAttemptsByCase(caseIds: readonly string[]): Map<string, Solve[]> | undefined {
  // The array is rebuilt on every render; its contents are what matters.
  const key = caseIds.join(',');
  return useLiveQuery(
    async () => (key === '' ? new Map<string, Solve[]>() : listAttemptsByCase(key.split(','))),
    [key],
  );
}

/** The statistics of attempts already in hand, by case. */
export function useStatsOf(
  attempts: Map<string, Solve[]> | undefined,
): Map<string, CaseStats> | undefined {
  return useMemo(() => {
    if (attempts === undefined) return undefined;
    const stats = new Map<string, CaseStats>();
    for (const [caseId, solves] of attempts) stats.set(caseId, caseStats(caseId, solves));
    return stats;
  }, [attempts]);
}

/** The same for a single case — the case sheet and the drill's answer. */
export function useCaseStat(caseId: string): CaseStats | undefined {
  return useCaseStats([caseId])?.get(caseId);
}

/**
 * The other half of the trainer's numbers: how long it takes to tell which
 * case this is. Counted by the same rules, over the attempts of the other
 * kind — a recognition is a second and a solve is five, and averaging them
 * together would describe neither.
 */
export function useRecognitionStats(
  caseIds: readonly string[],
): Map<string, CaseStats> | undefined {
  const key = caseIds.join(',');
  const attempts = useLiveQuery(
    async () => (key === '' ? new Map<string, never[]>() : listRecognitionsByCase(key.split(','))),
    [key],
  );

  return useMemo(() => {
    if (attempts === undefined) return undefined;
    const stats = new Map<string, CaseStats>();
    for (const [caseId, solves] of attempts) stats.set(caseId, caseStats(caseId, solves));
    return stats;
  }, [attempts]);
}

export function useRecognitionStat(caseId: string): CaseStats | undefined {
  return useRecognitionStats([caseId])?.get(caseId);
}
