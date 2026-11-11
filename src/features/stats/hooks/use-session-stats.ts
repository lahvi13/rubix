import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getMethodPbSolve,
  listPuzzleSolvesChronological,
  listSolvesChronological,
} from '../../../db/repositories/solve-repository';
import { listSessions } from '../../../db/repositories/session-repository';
import {
  getSetting,
  GOAL_SETTING,
  SETTING_DEFAULTS,
} from '../../../db/repositories/settings-repository';
import type { SupportedPuzzle } from '../../../domain/puzzle/puzzles';
import { sessionStats, type SessionStats } from '../../../domain/stats/session-stats';
import { useToday } from '../../../hooks/use-today';
import { dayKey } from '../../../lib/format';

/**
 * Whose solves: one session's, every freestyle solve of the sessions in use
 * that are timed in the method being timed in now, or the latest RECENT_SOLVES
 * of those. Across sessions means across the sessions of one method: a mean
 * over CFOP and Roux solves is a number about neither.
 */
export type StatsSource =
  | { kind: 'session'; sessionId: string | null }
  | { kind: 'all' }
  | { kind: 'recent' };

/**
 * Everything the stats screen shows, recomputed live. Nothing here is stored;
 * the whole object is derived from the solves on every write.
 */
export function useSessionStats(
  /** null while it is not yet known whose solves to read. */
  source: StatsSource | null,
  puzzle: SupportedPuzzle,
  phaseKeys: readonly string[] = [],
  /** Only the solves carrying this tag; null for all of them. */
  tagId: string | null = null,
): SessionStats | null {
  const kind = source?.kind ?? null;
  const sessionId = source?.kind === 'session' ? source.sessionId : null;
  const loaded = useLiveQuery(async () => {
    if (kind === null) return undefined;
    if (kind === 'session') return sessionId === null ? [] : listSolvesChronological(sessionId);
    return listPuzzleSolvesChronological(puzzle);
  }, [kind, sessionId, puzzle]);
  // Archived ones too: to say which method a solve was timed in.
  const sessions = useLiveQuery(() => listSessions(true), []);
  // The method the numbers are about: the one session's, or across sessions
  // the one being timed in. undefined until the sessions are in; null when
  // there is no session to say.
  const methodId = useMemo(() => {
    if (sessions === undefined) return undefined;
    const of =
      kind === 'session'
        ? sessions.find((session) => session.id === sessionId)
        : sessions.find(
            (session) =>
              session.puzzle === puzzle && session.mode === 'freestyle' && session.isActive === 1,
          );
    return of?.methodId ?? null;
  }, [sessions, kind, sessionId, puzzle]);
  const globalPb = useLiveQuery(
    () => (methodId == null ? null : getMethodPbSolve(puzzle, methodId)),
    [puzzle, methodId],
  );
  const chartWindow = useLiveQuery(() => getSetting('stats.chartWindow'), []);
  const goalMs = useLiveQuery(() => getSetting(GOAL_SETTING[puzzle]), [puzzle]);

  // Which method each session is timed in. Built when the sessions change, not
  // with every solve: the stats are worked out again after each one.
  const methodBySession = useMemo(
    () => new Map((sessions ?? []).map((session) => [session.id, session.methodId])),
    [sessions],
  );
  // The practice calendar ends today and the streak is counted back from it,
  // so a screen left open over midnight has to be told the day changed.
  const todayKey = useToday();

  return useMemo(() => {
    if (loaded === undefined || sessions === undefined || methodId === undefined) return null;
    if (kind === null) return null;
    return sessionStats({
      solves: loaded,
      kind,
      methodId,
      methodBySession,
      tagId,
      chartWindow: chartWindow ?? SETTING_DEFAULTS['stats.chartWindow'],
      goalMs: goalMs ?? 0,
      phaseKeys,
      // Still on its way, the best is not known yet: the rest is not kept waiting.
      globalPb: globalPb ?? null,
      todayKey,
      dayKeyOf: dayKey,
    });
  }, [loaded, sessions, kind, tagId, globalPb, chartWindow, goalMs, phaseKeys, methodId, methodBySession, todayKey]);
}
