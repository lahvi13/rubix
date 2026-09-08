import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAttemptsByCase } from '../../../db/repositories/drill-repository';
import { listRecognitionsByCase } from '../../../db/repositories/recognition-repository';
import { caseStats, type CaseStats } from '../../../domain/drill/case-stats';

/**
 * Drill statistics for a list of cases, live. Undefined until the database
 * answers: an empty map reads as "never drilled", which is a different thing
 * to show than "not loaded yet".
 */
export function useCaseStats(caseIds: readonly string[]): Map<string, CaseStats> | undefined {
  // The array is rebuilt on every render; its contents are what matters.
  const key = caseIds.join(',');
  const attempts = useLiveQuery(
    async () => (key === '' ? new Map<string, never[]>() : listAttemptsByCase(key.split(','))),
    [key],
  );

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
