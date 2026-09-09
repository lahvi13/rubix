import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listSolvesChronological } from '../../../db/repositories/solve-repository';
import { dayKey } from '../../../lib/format';

export interface SolveDay {
  /** What the filter matches on. */
  key: string;
  /** A moment inside the day, so it can be written out. */
  at: number;
  count: number;
}

/**
 * The days this session was practised on, newest first, with how many solves
 * fell on each. Only days that happened: a picker offering empty ones would be
 * a calendar, and the question is "when did I train", not "what is a date".
 */
export function useSolveDays(sessionId: string | null): SolveDay[] {
  const solves = useLiveQuery(
    async () => (sessionId === null ? [] : listSolvesChronological(sessionId)),
    [sessionId],
  );

  return useMemo(() => {
    const days = new Map<string, SolveDay>();
    for (const solve of solves ?? []) {
      const key = dayKey(solve.createdAt);
      const day = days.get(key);
      if (day === undefined) days.set(key, { key, at: solve.createdAt, count: 1 });
      else day.count += 1;
    }
    // The read is oldest first; the history is not.
    return [...days.values()].reverse();
  }, [solves]);
}
