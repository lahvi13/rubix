import { useLiveQuery } from 'dexie-react-hooks';
import type { Penalty, Solve } from '../../../db/types';
import { deleteCaseAttempts, listCaseAttempts } from '../../../db/repositories/drill-repository';
import { setPenalty } from '../../../db/repositories/solve-repository';
import { useRemoveSolves, useUndoableDelete } from '../../../hooks/use-remove-solves';

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
  const removeSolves = useRemoveSolves();
  const removeBy = useUndoableDelete();
  const attempts = useLiveQuery(
    async () => (caseId === null ? [] : (await listCaseAttempts(caseId)).reverse()),
    [caseId],
  );

  return {
    attempts: attempts ?? [],
    isLoading: attempts === undefined,
    changePenalty: setPenalty,
    remove: (id) => removeSolves([id]),
    removeAll: async () => {
      if (caseId !== null) await removeBy(() => deleteCaseAttempts(caseId));
    },
  };
}
