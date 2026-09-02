import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Puzzle } from '../../../db/types';
import {
  getGlobalPbSingle,
  listSolvesChronological,
} from '../../../db/repositories/solve-repository';
import { getSetting, SETTING_DEFAULTS } from '../../../db/repositories/settings-repository';
import { finalMs } from '../../../domain/solve/final-time';
import {
  AVERAGE_WINDOWS,
  bestAverage,
  currentAverage,
  rollingAverage,
  type Average,
  type AverageWindow,
} from '../../../domain/stats/averages';
import {
  histogram,
  penaltyRate,
  sessionMean,
  sessionMedian,
  standardDeviation,
  type HistogramBin,
} from '../../../domain/stats/distribution';
import { pbSingle } from '../../../domain/stats/pb';

/** The trend chart tracks rolling ao12 (SPEC 3.4). */
const TREND_WINDOW = 12;

export interface WindowStats {
  n: AverageWindow;
  current: Average;
  best: Average;
}

export interface TrendPoint {
  /** 1-based solve index within the session — the chart's x axis. */
  index: number;
  aoMs: number | null;
}

export interface SessionStats {
  solveCount: number;
  windows: WindowStats[];
  sessionBestMs: number | null;
  /** Best single across every freestyle session of the puzzle. */
  globalPbMs: number | null;
  meanMs: number | null;
  medianMs: number | null;
  stdDevMs: number | null;
  dnfRate: number | null;
  plusTwoRate: number | null;
  histogramBins: HistogramBin[];
  trend: TrendPoint[];
}

/**
 * Everything the stats screen shows, recomputed live. Nothing here is stored;
 * the whole object is derived from the session's solves on every write.
 */
export function useSessionStats(sessionId: string | null, puzzle: Puzzle): SessionStats | null {
  const solves = useLiveQuery(
    async () => (sessionId ? listSolvesChronological(sessionId) : []),
    [sessionId],
  );
  const globalPbMs = useLiveQuery(() => getGlobalPbSingle(puzzle), [puzzle]);
  const chartWindow = useLiveQuery(() => getSetting('stats.chartWindow'), []);

  return useMemo(() => {
    if (solves === undefined) return null;

    const finals = solves.map(finalMs);
    const rolling = rollingAverage(finals, TREND_WINDOW);
    const trendStart = Math.max(
      0,
      finals.length - (chartWindow ?? SETTING_DEFAULTS['stats.chartWindow']),
    );

    return {
      solveCount: solves.length,
      windows: AVERAGE_WINDOWS.map((n) => ({
        n,
        current: currentAverage(finals, n),
        best: bestAverage(finals, n),
      })),
      sessionBestMs: pbSingle(finals),
      globalPbMs: globalPbMs ?? null,
      meanMs: sessionMean(finals),
      medianMs: sessionMedian(finals),
      stdDevMs: standardDeviation(finals),
      dnfRate: penaltyRate(solves, 'dnf'),
      plusTwoRate: penaltyRate(solves, 'plus2'),
      histogramBins: histogram(finals),
      trend: rolling
        .slice(trendStart)
        .map((aoMs, offset) => ({ index: trendStart + offset + 1, aoMs })),
    };
  }, [solves, globalPbMs, chartWindow]);
}
