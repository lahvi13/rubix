import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Puzzle, Solve } from '../db/types';
import { getGlobalPbSolve } from '../db/repositories/solve-repository';
import { finalMs } from '../domain/solve/final-time';
import { bestsOf, type Bests } from '../domain/stats/phases';
import { useSessionSolves } from './use-session-solves';

const NO_BESTS: Bests = { totalMs: null, phaseMs: [] };

export interface SessionRecords {
  /** Best result and best phase lengths, over the whole session. */
  bests: Bests;
  /** The best single of this puzzle anywhere, which may be another session's. */
  globalPbMs: number | null;
}

/**
 * What counts as a record, for wherever a solve is shown. One hook, because a
 * mark that means one thing in the history and another on the timer is worse
 * than no mark: the reader has to remember which screen they are on.
 *
 * Read from the whole session rather than from the list in front of the reader.
 * The timer's list is the latest fifty and the history's is whatever the
 * filters allow, and a best of either is a fact about the list, not the solve.
 */
export function useSessionRecords(
  sessionId: string | null,
  puzzle: Puzzle,
  phaseKeys: readonly string[],
): SessionRecords {
  return useRecordsOf(useSessionSolves(sessionId), puzzle, phaseKeys);
}

/** The same, over a session's solves the caller has already read (`useSessionSolves`). */
export function useRecordsOf(
  solves: readonly Solve[] | undefined,
  puzzle: Puzzle,
  phaseKeys: readonly string[],
): SessionRecords {
  // Its own query: no filter on one session can move the best of them all, and
  // re-reading every solve of the puzzle each time one is tapped would be work
  // for an answer already known.
  const pb = useLiveQuery(() => getGlobalPbSolve(puzzle), [puzzle]);

  const bests = useMemo(
    () => (solves === undefined ? NO_BESTS : bestsOf(solves, phaseKeys)),
    [solves, phaseKeys],
  );

  return {
    bests,
    globalPbMs: pb === undefined || pb === null ? null : finalMs(pb),
  };
}
