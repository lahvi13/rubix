import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listSolvesChronological } from '../../../db/repositories/solve-repository';
import { finalMs } from '../../../domain/solve/final-time';
import { currentAverage, type Average } from '../../../domain/stats/averages';
import { sessionMean } from '../../../domain/stats/distribution';

export interface MiniStatsValues {
  solveCount: number;
  ao5: Average;
  ao12: Average;
  meanMs: number | null;
}

/**
 * The three numbers under the timer, and nothing else. It used to borrow the
 * stats screen's hook, which also worked out records, histograms, phase tables
 * and a year of days — after every solve, on the screen where a stall right
 * after the stop is the one place it is felt.
 */
export function useMiniStats(sessionId: string | null): MiniStatsValues | null {
  const solves = useLiveQuery(
    async () => (sessionId === null ? [] : listSolvesChronological(sessionId)),
    [sessionId],
  );

  return useMemo(() => {
    if (solves === undefined) return null;
    const finals = solves.map(finalMs);
    return {
      solveCount: solves.length,
      ao5: currentAverage(finals, 5),
      ao12: currentAverage(finals, 12),
      meanMs: sessionMean(finals),
    };
  }, [solves]);
}
