import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { MethodPhase, Session, Solve } from '../../../db/types';
import { getMethodPhases } from '../../../db/repositories/method-repository';
import { getSession } from '../../../db/repositories/session-repository';
import { getSolve, updateSolve, type SolvePatch } from '../../../db/repositories/solve-repository';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';

export interface SolveDetailView {
  /** undefined while loading and once the solve is gone. */
  solve: Solve | undefined;
  /** The solve's own session, which is not always the one on screen. */
  session: Session | null | undefined;
  /**
   * The phases of the method that session is timed in — the ones the solve's
   * splits were recorded under. undefined while loading.
   */
  phases: readonly MethodPhase[] | undefined;
  edit: (id: string, patch: SolvePatch) => void;
}

export function useSolveDetail(solveId: string): SolveDetailView {
  const solve = useLiveQuery(() => getSolve(solveId), [solveId]);
  // One query for both: the phases are the session's, and a sheet drawn for a
  // tick with the session and without its phases is a sheet missing a section.
  const own = useLiveQuery(async () => {
    if (!solve) return null;
    const session = (await getSession(solve.sessionId)) ?? null;
    return { session, phases: session === null ? [] : await getMethodPhases(session.methodId) };
  }, [solve?.sessionId]);
  const session = own === undefined ? undefined : (own?.session ?? null);
  const phases = own === undefined ? undefined : (own?.phases ?? []);
  const edit = useCallback((id: string, patch: SolvePatch) => {
    watchWrite(() => updateSolve(id, patch), strings.history.detailTitle);
  }, []);
  return { solve, session, phases, edit };
}
