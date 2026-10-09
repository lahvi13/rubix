import { useMemo } from 'react';
import type { Solve } from '../../../db/types';
import { finalMs } from '../../../domain/solve/final-time';
import { currentAverage, type Average } from '../../../domain/stats/averages';
import { sessionMean } from '../../../domain/stats/distribution';
import { recordThreshold } from '../../../domain/stats/record-threshold';

export interface MiniStatsValues {
  solveCount: number;
  ao5: Average;
  ao12: Average;
  meanMs: number | null;
  /**
   * The averages the next solve can still make a best of the session, and
   * the result it needs for each. A best out of reach is left out.
   */
  nextRecords: NextRecord[];
}

export interface NextRecord {
  n: number;
  belowMs: number;
}

const NEXT_RECORD_WINDOWS = [5, 12] as const;

/**
 * The numbers under the timer and what the next solve needs to beat
 * the session's best averages, and nothing else. It used to borrow the
 * stats screen's hook, which also worked out records, histograms, phase tables
 * and a year of days — after every solve, on the screen where a stall right
 * after the stop is the one place it is felt.
 */
export function useMiniStats(solves: readonly Solve[] | undefined): MiniStatsValues | null {
  return useMemo(() => {
    if (solves === undefined) return null;
    const finals = solves.map(finalMs);
    return {
      solveCount: solves.length,
      ao5: currentAverage(finals, 5),
      ao12: currentAverage(finals, 12),
      meanMs: sessionMean(finals),
      nextRecords: NEXT_RECORD_WINDOWS.flatMap((n) => {
        const threshold = recordThreshold(finals, n);
        return threshold?.kind === 'below' ? [{ n, belowMs: threshold.belowMs }] : [];
      }),
    };
  }, [solves]);
}
