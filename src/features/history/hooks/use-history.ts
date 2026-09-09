import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Puzzle, Solve } from '../../../db/types';
import {
  countSolves,
  listMatchingSolves,
  updateSolve,
  type SolveFilters,
  type SolvePatch,
} from '../../../db/repositories/solve-repository';
import { finalMs } from '../../../domain/solve/final-time';
import { dayKey } from '../../../lib/format';
import { bestPhasesIn, type Bests } from '../../../domain/stats/phases';
import { useRemoveSolves } from '../../../hooks/use-remove-solves';
import { useSessionRecords } from '../../../hooks/use-session-records';

const PAGE_SIZE = 50;

export interface HistoryView {
  solves: Solve[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  filters: SolveFilters;
  /** Best result and best phase lengths over the whole session. */
  bests: Bests;
  /** The best single of this puzzle anywhere, which may be another session's. */
  globalPbMs: number | null;
  setFilters: (filters: SolveFilters) => void;
  loadMore: () => void;
  edit: (id: string, patch: SolvePatch) => Promise<void>;
  removeMany: (ids: readonly string[]) => Promise<void>;
}

/**
 * Paged by growing the limit rather than by offset: with newest-first ordering
 * a page boundary would otherwise shift every time a solve is added.
 *
 * The records are read from the whole session, never from the filtered list.
 * A mark you can filter by has to belong to the solve: were it the best of
 * whatever the filters let through, turning the filter on would move the marks
 * it was meant to be selecting, and asking for "only the records" would be a
 * question about its own answer.
 */
export function useHistory(
  sessionId: string | null,
  puzzle: Puzzle,
  phaseKeys: readonly string[],
): HistoryView {
  const removeSolves = useRemoveSolves();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState<SolveFilters>({});

  const { bests, globalPbMs } = useSessionRecords(sessionId, puzzle, phaseKeys);

  const result = useLiveQuery(async () => {
    if (!sessionId) return { matched: [], total: 0 };
    const [matched, total] = await Promise.all([
      listMatchingSolves(sessionId, filters),
      countSolves(sessionId),
    ]);
    return { matched, total };
  }, [sessionId, filters]);

  // The record filter is applied here rather than in the query: what counts as
  // a record is worked out from the session's solves, which the query has no
  // way of knowing while it is running.
  const matched = useMemo(() => {
    let rows = result?.matched ?? [];
    if (filters.day !== undefined) {
      const day = filters.day;
      rows = rows.filter((solve) => dayKey(solve.createdAt) === day);
    }
    if (filters.record) {
      rows = rows.filter(
        (solve) =>
          (finalMs(solve) !== null && finalMs(solve) === bests.totalMs) ||
          bestPhasesIn(solve, phaseKeys, bests).length > 0,
      );
    }
    return rows;
  }, [result, filters.record, filters.day, bests, phaseKeys]);

  return {
    solves: matched.slice(0, limit),
    total: result?.total ?? 0,
    isLoading: result === undefined,
    hasMore: matched.length > limit,
    filters,
    bests,
    globalPbMs,
    setFilters: (next) => {
      setFilters(next);
      setLimit(PAGE_SIZE);
    },
    loadMore: () => setLimit((current) => current + PAGE_SIZE),
    edit: updateSolve,
    removeMany: removeSolves,
  };
}
