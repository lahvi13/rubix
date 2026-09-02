import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Solve } from '../../../db/types';
import {
  countSolves,
  deleteSolves,
  listSolves,
  updateSolve,
  type SolveFilters,
  type SolvePatch,
} from '../../../db/repositories/solve-repository';

const PAGE_SIZE = 50;

export interface HistoryView {
  solves: Solve[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  filters: SolveFilters;
  setFilters: (filters: SolveFilters) => void;
  loadMore: () => void;
  edit: (id: string, patch: SolvePatch) => Promise<void>;
  removeMany: (ids: string[]) => Promise<void>;
}

/**
 * Paged by growing the limit rather than by offset: with newest-first ordering
 * a page boundary would otherwise shift every time a solve is added.
 */
export function useHistory(sessionId: string | null): HistoryView {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState<SolveFilters>({});

  const result = useLiveQuery(async () => {
    if (!sessionId) return { solves: [], total: 0 };
    const [solves, total] = await Promise.all([
      // One extra row tells us whether another page exists.
      listSolves(sessionId, limit + 1, filters),
      countSolves(sessionId),
    ]);
    return { solves, total };
  }, [sessionId, limit, filters]);

  const solves = result?.solves ?? [];
  const hasMore = solves.length > limit;

  return {
    solves: hasMore ? solves.slice(0, limit) : solves,
    total: result?.total ?? 0,
    isLoading: result === undefined,
    hasMore,
    filters,
    setFilters: (next) => {
      setFilters(next);
      setLimit(PAGE_SIZE);
    },
    loadMore: () => setLimit((current) => current + PAGE_SIZE),
    edit: updateSolve,
    removeMany: deleteSolves,
  };
}
