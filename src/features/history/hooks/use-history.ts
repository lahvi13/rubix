import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Solve } from '../../../db/types';
import {
  countSolves,
  deleteSolves,
  listMatchingSolves,
  updateSolve,
  type SolveFilters,
  type SolvePatch,
} from '../../../db/repositories/solve-repository';
import { bestsOf, type Bests } from '../../../domain/stats/phases';

const PAGE_SIZE = 50;

const NO_BESTS: Bests = { totalMs: null, phaseMs: [] };

export interface HistoryView {
  solves: Solve[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  filters: SolveFilters;
  /** Best result and best phase lengths over everything the filters match. */
  bests: Bests;
  setFilters: (filters: SolveFilters) => void;
  loadMore: () => void;
  edit: (id: string, patch: SolvePatch) => Promise<void>;
  removeMany: (ids: string[]) => Promise<void>;
}

/**
 * Paged by growing the limit rather than by offset: with newest-first ordering
 * a page boundary would otherwise shift every time a solve is added.
 *
 * The page is cut from the matched solves here rather than by the query,
 * because the bests marked in the list are the bests of the whole match — the
 * same reading has to serve both, or the two would disagree about which
 * solves are being talked about.
 */
export function useHistory(sessionId: string | null, phaseKeys: readonly string[]): HistoryView {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState<SolveFilters>({});

  const result = useLiveQuery(async () => {
    if (!sessionId) return { matched: [], total: 0 };
    const [matched, total] = await Promise.all([
      listMatchingSolves(sessionId, filters),
      countSolves(sessionId),
    ]);
    return { matched, total };
  }, [sessionId, filters]);

  const matched = result?.matched ?? [];
  const bests = useMemo(
    () => (result === undefined ? NO_BESTS : bestsOf(result.matched, phaseKeys)),
    [result, phaseKeys],
  );

  return {
    solves: matched.slice(0, limit),
    total: result?.total ?? 0,
    isLoading: result === undefined,
    hasMore: matched.length > limit,
    filters,
    bests,
    setFilters: (next) => {
      setFilters(next);
      setLimit(PAGE_SIZE);
    },
    loadMore: () => setLimit((current) => current + PAGE_SIZE),
    edit: updateSolve,
    removeMany: deleteSolves,
  };
}
