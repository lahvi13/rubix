import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Session, Solve } from '../../../db/types';
import { getSession } from '../../../db/repositories/session-repository';
import { getSolve, updateSolve, type SolvePatch } from '../../../db/repositories/solve-repository';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';

export interface SolveDetailView {
  /** undefined while loading and once the solve is gone. */
  solve: Solve | undefined;
  /** The solve's own session, which is not always the one on screen. */
  session: Session | null | undefined;
  edit: (id: string, patch: SolvePatch) => void;
}

export function useSolveDetail(solveId: string): SolveDetailView {
  const solve = useLiveQuery(() => getSolve(solveId), [solveId]);
  const session = useLiveQuery(
    async () => (solve ? ((await getSession(solve.sessionId)) ?? null) : null),
    [solve?.sessionId],
  );
  const edit = useCallback((id: string, patch: SolvePatch) => {
    watchWrite(() => updateSolve(id, patch), strings.history.detailTitle);
  }, []);
  return { solve, session, edit };
}
