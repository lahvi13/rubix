import { useLiveQuery } from 'dexie-react-hooks';
import type { Penalty, Solve } from '../../../db/types';
import {
  deleteSolve,
  listRecentSolves,
  setPenalty,
} from '../../../db/repositories/solve-repository';

const RECENT_LIMIT = 50;

export interface RecentSolves {
  solves: Solve[];
  isLoading: boolean;
  changePenalty: (id: string, penalty: Penalty) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Live list of the session's latest solves; re-renders itself on every write. */
export function useRecentSolves(sessionId: string | null): RecentSolves {
  const solves = useLiveQuery(
    async () => (sessionId ? listRecentSolves(sessionId, RECENT_LIMIT) : []),
    [sessionId],
  );

  return {
    solves: solves ?? [],
    isLoading: solves === undefined,
    changePenalty: setPenalty,
    remove: deleteSolve,
  };
}
