import { useLiveQuery } from 'dexie-react-hooks';
import type { Penalty, Solve } from '../../../db/types';
import {
  countSolves,
  listRecentSolves,
  setPenalty,
} from '../../../db/repositories/solve-repository';
import { useRemoveSolves } from '../../../hooks/use-remove-solves';

const RECENT_LIMIT = 50;

export interface RecentSolves {
  solves: Solve[];
  /** The whole session's size. The list stops at fifty; the count must not. */
  total: number;
  isLoading: boolean;
  changePenalty: (id: string, penalty: Penalty) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Live list of the session's latest solves; re-renders itself on every write. */
export function useRecentSolves(sessionId: string | null): RecentSolves {
  const removeSolves = useRemoveSolves();
  const recent = useLiveQuery(async () => {
    if (!sessionId) return { solves: [], total: 0 };
    const [solves, total] = await Promise.all([
      listRecentSolves(sessionId, RECENT_LIMIT),
      countSolves(sessionId),
    ]);
    return { solves, total };
  }, [sessionId]);

  return {
    solves: recent?.solves ?? [],
    total: recent?.total ?? 0,
    isLoading: recent === undefined,
    changePenalty: setPenalty,
    remove: (id) => removeSolves([id]),
  };
}
