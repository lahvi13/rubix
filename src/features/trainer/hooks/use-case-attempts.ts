import { useLiveQuery } from 'dexie-react-hooks';
import type { Penalty, Solve } from '../../../db/types';
import { deleteCaseAttempts, listCaseAttempts } from '../../../db/repositories/drill-repository';
import { deleteSolve, setPenalty } from '../../../db/repositories/solve-repository';

export interface CaseAttemptsView {
  /** Newest first — the one you would want to fix is the one you just did. */
  attempts: Solve[];
  isLoading: boolean;
  changePenalty: (id: string, penalty: Penalty) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
}

/**
 * The attempts of one case, with the three things anybody wants to do to
 * them: a penalty the timer could not know about, a time that was a dropped
 * cube rather than a solve, and starting the whole case again.
 */
export function useCaseAttempts(caseId: string | null): CaseAttemptsView {
  const attempts = useLiveQuery(
    async () => (caseId === null ? [] : (await listCaseAttempts(caseId)).reverse()),
    [caseId],
  );

  return {
    attempts: attempts ?? [],
    isLoading: attempts === undefined,
    changePenalty: setPenalty,
    remove: deleteSolve,
    removeAll: async () => {
      if (caseId !== null) await deleteCaseAttempts(caseId);
    },
  };
}
