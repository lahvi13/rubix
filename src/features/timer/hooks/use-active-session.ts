import { useEffect, useState } from 'react';
import type { Puzzle, Session, SolveMode } from '../../../db/types';
import { getOrCreateActiveSession } from '../../../db/repositories/session-repository';

/**
 * Resolves the session new solves belong to, creating the implicit "Default"
 * one on first run. Session switching arrives in phase 2.
 */
export function useActiveSession(puzzle: Puzzle, mode: SolveMode): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOrCreateActiveSession(puzzle, mode).then((result) => {
      if (!cancelled) setSession(result);
    });
    return () => {
      cancelled = true;
    };
  }, [puzzle, mode]);

  return session;
}
