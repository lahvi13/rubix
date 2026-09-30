import { useCallback } from 'react';
import type { Solve } from '../../../db/types';
import { addSolve } from '../../../db/repositories/solve-repository';
import type { CompletedAttempt } from '../../../hooks/use-timer';
import { now } from '../../../lib/clock';
import { watchWrite } from '../../../lib/errors';
import { strings } from '../../../lib/strings';

export interface FinishedSolve {
  sessionId: string;
  puzzle: Solve['puzzle'];
  mode: Solve['mode'];
  scramble: string;
  scrambleSource: Solve['scrambleSource'];
  attempt: CompletedAttempt;
  phaseKeys: readonly string[];
}

/**
 * Files a finished attempt. Watched rather than fired and forgotten: a write
 * the phone refuses is tried again on a reopened connection, and if that fails
 * too the banner offers the attempt back instead of the time being gone.
 * `onSaved` runs once the row is in, and again only if the write is retried.
 */
export function useSaveSolve(): (solve: FinishedSolve, onSaved: () => void) => void {
  return useCallback((solve: FinishedSolve, onSaved: () => void) => {
    const { attempt, phaseKeys } = solve;
    const startedAt = now() - Math.round(attempt.rawMs);
    watchWrite(
      () =>
        addSolve({
          sessionId: solve.sessionId,
          puzzle: solve.puzzle,
          mode: solve.mode,
          scramble: solve.scramble,
          scrambleSource: solve.scrambleSource,
          rawMs: attempt.rawMs,
          penalty: attempt.penalty,
          // Anything set at this point came from the inspection rules, not the user.
          penaltySource: 'auto',
          inspectionMs: attempt.inspectionMs,
          startedAt,
          splits: attempt.splitMs.map((atMs, index) => ({
            phase: phaseKeys[index] ?? '',
            atMs: Math.round(atMs),
            source: 'manual' as const,
          })),
          phaseKeys,
        }).then(onSaved),
      strings.errors.saveSolve,
    );
  }, []);
}
