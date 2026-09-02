import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Puzzle, Session, SolveMode } from '../../../db/types';
import {
  getActiveSession,
  getOrCreateActiveSession,
} from '../../../db/repositories/session-repository';

/**
 * The session new solves belong to. Live, so switching sessions on the
 * sessions screen redirects the timer without a reload.
 */
export function useActiveSession(puzzle: Puzzle, mode: SolveMode): Session | null {
  const session = useLiveQuery(() => getActiveSession(puzzle, mode), [puzzle, mode]);

  // Nothing active means first run, or the active session was archived.
  useEffect(() => {
    if (session === null) void getOrCreateActiveSession(puzzle, mode);
  }, [session, puzzle, mode]);

  return session ?? null;
}
