/**
 * Everything the stats screen shows, from the solves it is about. Pure: the
 * solves, the reader's choices and what day it is go in; nothing is read from
 * a clock or a database here, so the whole of it can be put through a table of
 * cases — and timed over five thousand solves, which is what it runs over
 * after every solve.
 */

import type { Penalty, Solve } from '../../db/types';
import { finalMs } from '../solve/final-time';
import {
  AVERAGE_WINDOWS,
  bestAverage,
  bestAverageStart,
  currentAverage,
  windowAverage,
  rollingAverage,
  trimCount,
  trimmedMask,
  type Average,
  type AverageWindow,
} from './averages';
import {
  histogram,
  penaltyRate,
  shareUnder,
  sessionMean,
  sessionMedian,
  standardDeviation,
  upperFence,
  type HistogramBin,
} from './distribution';
import { pbSingle } from './pb';
import {
  measuredSolves,
  phaseAverageTable,
  phaseTrend,
  type PhaseAverageRow,
  type PhaseTrendPoint,
} from './phases';
import { recordProgression } from './progression';
import { solvesInScope, solvesOfMethod } from './scope';
import { calendarDays, dayNumber, practiceStreak, summariseDays } from './daily';

/** The practice chart's reach, in calendar days ending today. */
export const PRACTICE_DAYS = 30;

/** How far back "lately" reaches when a goal is measured against current form. */
export const GOAL_RECENT_SOLVES = 50;

/** The trend chart tracks rolling ao12 (SPEC 3.4). */
export const TREND_WINDOW = 12;

/** The slower line under it, which says whether today's ao12 is a change of form. */
const LONG_TREND_WINDOW = 50;

/** How many solves "the latest" reads across every session. */
export const RECENT_SOLVES = 100;

export interface WindowStats {
  n: AverageWindow;
  current: Average;
  best: Average;
}

/**
 * Which n solves: the latest, the best in a row, or the ones ending at a
 * given solve — where a record in the history was set.
 */
export type WindowAt = 'current' | 'best' | { endIndex: number };

/** A history of records is kept for singles and for every average window. */
export type RecordKind = 'single' | AverageWindow;

export interface RecordEntry {
  ms: number;
  /** How much faster than the record it beat; null for the first. */
  improvementMs: number | null;
  /** When the solve that set it was done. */
  at: number;
  /** That solve — for an average, the last of its window. */
  solveId: string;
  /** Where that solve sits among the solves being read. */
  endIndex: number;
}

export interface WindowSolve {
  id: string;
  /** null is a DNF. */
  resultMs: number | null;
  penalty: Penalty;
  /** Cut by the trim, so it is in the window but not in the average. */
  isTrimmed: boolean;
  createdAt: number;
  /** What it was timed on — the window's scrambles are what a shared average carries. */
  scramble: string;
}

/** The solves behind one number in the averages table. */
export interface AverageWindowView {
  n: AverageWindow;
  at: WindowAt;
  average: Average;
  /** How many the trim cuts from each end. */
  trim: number;
  /** Oldest first, as they were solved. */
  solves: WindowSolve[];
}

export interface TrendPoint {
  /** 1-based solve index within the solves being read — the chart's x axis. */
  index: number;
  /** When the solve was made, so the readout can say which day it was. */
  at: number;
  aoMs: number | null;
  /** Null until the fiftieth solve, and over a DNF average. */
  longAoMs: number | null;
  /** The solve's own result, drawn as a dot behind the line; null is a DNF. */
  singleMs: number | null;
}

export interface DayPoint {
  /** Whole days, so the axis keeps the gaps between days of practice. */
  day: number;
  dayKey: string;
  count: number;
  meanMs: number | null;
  bestMs: number | null;
}

export interface PracticeStats {
  /** The last PRACTICE_DAYS calendar days, oldest first, zeros included. */
  days: { day: number; dayKey: string; count: number }[];
  /** Days in a row with a solve, ending today (or yesterday, if today is still to come). */
  streak: number;
  /** Days of the window with at least one solve. */
  activeDays: number;
  /** Solves in the window. */
  solveCount: number;
}

export interface GoalStats {
  goalMs: number;
  /** Fraction of every solve that beat it. */
  allRate: number | null;
  /** The same over the latest GOAL_RECENT_SOLVES, or fewer when there are fewer. */
  recentRate: number | null;
  recentCount: number;
}

export interface SessionStats {
  solveCount: number;
  /**
   * Every solve the source could have read, the tag's only when there is one —
   * more than solveCount only for 'recent'.
   */
  availableCount: number;
  windows: WindowStats[];
  sessionBestMs: number | null;
  /** The solve behind it, so the number can be opened rather than only read. */
  sessionBestSolveId: string | null;
  /** Best single across every freestyle session of the puzzle timed in the method. */
  globalPbMs: number | null;
  /** Likewise, and it may well belong to another session. */
  globalPbSolveId: string | null;
  meanMs: number | null;
  medianMs: number | null;
  stdDevMs: number | null;
  dnfRate: number | null;
  plusTwoRate: number | null;
  histogramBins: HistogramBin[];
  /**
   * Rolling ao12, from the first solve that has one. The empty run before the
   * window fills is not carried: it is half a chart saying nothing, and the
   * index on each point already says which solve it belongs to.
   */
  trend: TrendPoint[];
  /**
   * Singles slower than this are left off the chart's scale — see upperFence.
   * Infinity when every single may have its say.
   */
  trendFenceMs: number;
  /** The two ao12 marks the charts point at: where the session is, and its record. */
  currentAo12Ms: number | null;
  bestAo12Ms: number | null;
  /** Average length of each phase, per window. Empty without a method to name them. */
  phaseRows: PhaseAverageRow[];
  /** How many of the solves were timed by phase — the sample behind phaseRows. */
  measuredCount: number;
  /** One point per phase-timed solve — raw lengths plus the rolling mean. */
  phaseTrend: PhaseTrendPoint[];
  /** null while no goal is set. */
  goal: GoalStats | null;
  /** Every day with a solve, oldest first — the trend read by the calendar. */
  days: DayPoint[];
  practice: PracticeStats;
  /** The window behind an average, or null where there is no number to explain. */
  averageWindow: (n: AverageWindow, at: WindowAt) => AverageWindowView | null;
  /** Every time the record fell, newest first. */
  recordsFor: (kind: RecordKind) => RecordEntry[];
}

/**
 * Whose solves the numbers are about: one session's, every session's of the
 * method being timed in, or the latest RECENT_SOLVES of those.
 */
export type StatsScopeKind = 'session' | 'all' | 'recent';

export interface SessionStatsInput {
  /** Oldest first: one session's, or every freestyle solve of the puzzle. */
  solves: readonly Solve[];
  kind: StatsScopeKind;
  /** The method the numbers are about; null when there is no session to say. */
  methodId: string | null;
  /** Which method each session is timed in — archived sessions too. */
  methodBySession: ReadonlyMap<string, string>;
  /** Only the solves carrying this tag; null for all of them. */
  tagId: string | null;
  /** How many of the latest solves the trend charts draw. */
  chartWindow: number;
  /** The time being chased; 0 or less for none. */
  goalMs: number;
  phaseKeys: readonly string[];
  /** The best single of the method across all its sessions, if there is one. */
  globalPb: Solve | null;
  /** The reader's today, as a day key. */
  todayKey: string;
  /**
   * Which day a moment falls on for the reader. Handed in rather than worked
   * out here: it is a question about their timezone, and this module has none.
   */
  dayKeyOf: (ms: number) => string;
}

/**
 * The whole of the stats screen. Nothing in it is stored; it is worked out
 * again from the solves on every write.
 */
export function sessionStats(input: SessionStatsInput): SessionStats {
  const {
    solves: loaded,
    kind,
    methodId,
    methodBySession,
    tagId,
    chartWindow,
    goalMs,
    phaseKeys,
    globalPb,
    todayKey,
    dayKeyOf,
  } = input;

  // One session is one method already. Across sessions the solves may have
  // been timed in several, and only those of the method are read: averages,
  // records and phases alike.
  const ofMethod =
    kind === 'session' || methodId === null
      ? loaded
      : solvesOfMethod(loaded, methodBySession, methodId);
  const { pool, read: solves } = solvesInScope(
    ofMethod,
    tagId,
    kind === 'recent' ? RECENT_SOLVES : null,
  );

  const finals = solves.map(finalMs);
  const rolling = rollingAverage(finals, TREND_WINDOW);
  const window = chartWindow;
  // The recent window the reader asked for. The solves before the first ao12
  // stay in it, as singles under a line still to come: cut, they left a
  // reader with eleven solves no trend at all and no word of when one would
  // appear.
  const trendStart = Math.max(0, finals.length - window);
  // Only the solves the chart draws, and the ones their windows reach back
  // into: a pass over every solve in the scope costs as much again, after
  // every solve, for averages nobody sees.
  const longStart = Math.max(0, trendStart - LONG_TREND_WINDOW + 1);
  const longRolling = rollingAverage(finals.slice(longStart), LONG_TREND_WINDOW);
  const windowed = rolling
    .slice(trendStart)
    .map((aoMs, offset) => ({
      index: trendStart + offset + 1,
      at: solves[trendStart + offset]?.createdAt ?? 0,
      aoMs,
      longAoMs: longRolling[trendStart + offset - longStart] ?? null,
      singleMs: finals[trendStart + offset] ?? null,
    }));
  // One solve is a dot, not a trend.
  const trend = windowed.length < 2 ? [] : windowed;

  const globalPbMs = globalPb === null ? null : finalMs(globalPb);
  const sessionBestMs = pbSingle(finals);
  // The row behind the number. Ties go to the earliest, which is the one
  // that set the record rather than one that matched it later.
  const sessionBest =
    sessionBestMs === null
      ? null
      : (solves.find((solve) => finalMs(solve) === sessionBestMs) ?? null);

  const currentAo12 = currentAverage(finals, TREND_WINDOW);
  const records = new Map<RecordKind, RecordEntry[]>();

  const summaries = summariseDays(
    solves.map((solve, index) => ({
      dayKey: dayKeyOf(solve.createdAt),
      finalMs: finals[index] ?? null,
    })),
  );
  // Practice is a question about the calendar, not about how many solves
  // are being read: the latest hundred can start partway through the month.
  const practiceDays =
    solves === pool
      ? summaries
      : summariseDays(
          pool.map((solve) => ({ dayKey: dayKeyOf(solve.createdAt), finalMs: finalMs(solve) })),
        );
  const countByDay = new Map(practiceDays.map((summary) => [summary.dayKey, summary.count]));
  const recentDays = calendarDays(todayKey, PRACTICE_DAYS).map((key) => ({
    day: dayNumber(key),
    dayKey: key,
    count: countByDay.get(key) ?? 0,
  }));
  const bestAo12 = bestAverage(finals, TREND_WINDOW);

  return {
    solveCount: solves.length,
    availableCount: pool.length,
    windows: AVERAGE_WINDOWS.map((n) => ({
      n,
      current: currentAverage(finals, n),
      best: bestAverage(finals, n),
    })),
    sessionBestMs,
    sessionBestSolveId: sessionBest?.id ?? null,
    globalPbMs,
    globalPbSolveId: globalPb?.id ?? null,
    meanMs: sessionMean(finals),
    medianMs: sessionMedian(finals),
    stdDevMs: standardDeviation(finals),
    dnfRate: penaltyRate(solves, 'dnf'),
    plusTwoRate: penaltyRate(solves, 'plus2'),
    histogramBins: histogram(finals),
    trend,
    trendFenceMs: upperFence(trend.map((point) => point.singleMs)),
    days: summaries.map((summary) => ({ ...summary, day: dayNumber(summary.dayKey) })),
    practice: {
      days: recentDays,
      streak: practiceStreak(new Set(countByDay.keys()), todayKey),
      activeDays: recentDays.filter((day) => day.count > 0).length,
      solveCount: recentDays.reduce((sum, day) => sum + day.count, 0),
    },
    recordsFor: (kind) => {
      // Kept per kind: an ao100 rolled over thousands of solves is work,
      // and only the kind on screen is ever asked for.
      const cached = records.get(kind);
      if (cached !== undefined) return cached;
      const series = kind === 'single' ? finals : rollingAverage(finals, kind);
      const entries = recordProgression(series)
        .map((step) => ({
          ms: step.ms,
          improvementMs: step.previousMs === null ? null : step.previousMs - step.ms,
          at: solves[step.index]?.createdAt ?? 0,
          solveId: solves[step.index]?.id ?? '',
          endIndex: step.index,
        }))
        .reverse();
      records.set(kind, entries);
      return entries;
    },
    // 'dnf' is not a place on a time axis; both marks simply go unmarked.
    currentAo12Ms: typeof currentAo12 === 'number' ? currentAo12 : null,
    bestAo12Ms: typeof bestAo12 === 'number' ? bestAo12 : null,
    phaseRows: phaseKeys.length === 0 ? [] : phaseAverageTable(solves, phaseKeys),
    measuredCount: measuredSolves(solves).length,
    phaseTrend: phaseTrend(solves, phaseKeys, window),
    goal:
      goalMs <= 0
        ? null
        : {
            goalMs,
            allRate: shareUnder(finals, goalMs),
            recentRate: shareUnder(finals.slice(-GOAL_RECENT_SOLVES), goalMs),
            recentCount: Math.min(finals.length, GOAL_RECENT_SOLVES),
          },
    averageWindow: (n, at) => {
      const start =
        at === 'current'
          ? finals.length - n
          : at === 'best'
            ? bestAverageStart(finals, n)
            : at.endIndex + 1 - n;
      if (start === null || start < 0 || start + n > finals.length) return null;
      const windowFinals = finals.slice(start, start + n);
      const trimmed = trimmedMask(windowFinals);
      return {
        n,
        at,
        average: windowAverage(windowFinals),
        trim: trimCount(n),
        solves: solves.slice(start, start + n).map((solve, offset) => ({
          id: solve.id,
          resultMs: windowFinals[offset] ?? null,
          penalty: solve.penalty,
          isTrimmed: trimmed[offset] ?? false,
          createdAt: solve.createdAt,
          scramble: solve.scramble,
        })),
      };
    },
  };
}
