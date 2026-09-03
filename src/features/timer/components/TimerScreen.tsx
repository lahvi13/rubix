import { useCallback, useMemo, useState } from 'react';
import type { Penalty } from '../../../db/types';
import { addSolve } from '../../../db/repositories/solve-repository';
import { now } from '../../../lib/clock';
import { strings } from '../../../lib/strings';
import { navigate } from '../../../app/router';
import { reportError } from '../../../lib/errors';
import { useActiveSession } from '../../sessions';
import { PhaseBar, usePhases } from '../../splits';
import { MiniStats } from '../../stats';
import { useRecentSolves } from '../hooks/use-recent-solves';
import { useScramble } from '../../../hooks/use-scramble';
import { useSetting } from '../../../hooks/use-setting';
import { useTimer, type CompletedAttempt } from '../../../hooks/use-timer';
import { ScramblePanel } from './ScramblePanel';
import { SolveList } from './SolveList';
import { TimerDisplay } from '../../../components/TimerDisplay';

const PUZZLE = '333';
const MODE = 'freestyle';
const EMPTY_PHASES: never[] = [];

export function TimerScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const scramble = useScramble(PUZZLE);
  const { solves, changePenalty, remove } = useRecentSolves(session?.id ?? null);
  const [splitMode, setSplitMode] = useSetting('timer.splitMode');
  const methodPhases = usePhases(session?.methodId ?? null);

  // Empty means the plain timer. The phases come from the session's method,
  // never from a list in the code (SPEC 3.6).
  const phases = splitMode === 'phases' ? methodPhases : EMPTY_PHASES;
  const phaseKeys = useMemo(() => phases.map((phase) => phase.key), [phases]);
  // After a solve the screen shows the result, not the next scramble; the
  // user moves on explicitly (or just starts the next attempt).
  const [showResult, setShowResult] = useState(false);

  const handleComplete = useCallback(
    (attempt: CompletedAttempt) => {
      setShowResult(true);

      if (!session) {
        // Losing a solve silently is worse than any other failure here.
        reportError(strings.errors.saveSolve, new Error(strings.errors.noSession));
        return;
      }

      void addSolve({
        sessionId: session.id,
        puzzle: PUZZLE,
        mode: MODE,
        // A missing scramble must not cost the user the time itself.
        scramble: scramble.scramble ?? '',
        rawMs: attempt.rawMs,
        penalty: attempt.penalty,
        // Anything set at this point came from the inspection rules, not the user.
        penaltySource: 'auto',
        inspectionMs: attempt.inspectionMs,
        startedAt: now() - Math.round(attempt.rawMs),
        splits: attempt.splitMs.map((atMs, index) => ({
          phase: phaseKeys[index] ?? '',
          atMs: Math.round(atMs),
          source: 'manual' as const,
        })),
        phaseKeys,
      })
        .then(() => {
          scramble.next();
        })
        .catch((cause: unknown) => {
          reportError(strings.errors.saveSolve, cause);
        });
    },
    [session, scramble, phaseKeys],
  );

  const timer = useTimer(handleComplete, { phases: phaseKeys });
  const status = timer.state.status;
  const isSolving = status === 'running';

  // Derived, not synchronized: the result stays up only while the machine is
  // at rest with a finished time. Starting the next attempt (or cancelling,
  // which wipes lastRawMs) hides it without any bookkeeping.
  const lastSolve = solves[0];
  const resultVisible =
    showResult &&
    (status === 'stopped' || (timer.state.status === 'idle' && timer.state.lastRawMs !== null));

  // Stable references, or the memo on SolveList would be defeated by the
  // per-frame re-renders while the timer is live.
  const handleChangePenalty = useCallback(
    (id: string, penalty: Penalty) => void changePenalty(id, penalty),
    [changePenalty],
  );
  const handleDelete = useCallback((id: string) => void remove(id), [remove]);

  return (
    <main className="screen">
      <div className="scramble-slot">
        <ScramblePanel
          scramble={scramble.scramble}
          error={scramble.error}
          onRetry={scramble.next}
          hidden={isSolving || resultVisible}
        />
        {resultVisible ? (
          <div className="result-bar">
            <button
              type="button"
              className="result-bar__next"
              onClick={() => {
                setShowResult(false);
                // Moving on to the next scramble takes the finished time off
                // the clock with it — it belongs to the solve now in the list.
                timer.reset();
              }}
            >
              {strings.timer.nextScramble}
            </button>
          </div>
        ) : null}
      </div>

      {/* One grid cell, so the phase bar stays with the number it belongs to
          instead of being pushed to the bottom by the stretching timer. */}
      <div className="timer-slot">
        <TimerDisplay
          state={timer.state}
          displayMs={timer.displayMs}
          inspectionMs={timer.inspectionMs}
          armed={timer.armed}
          finishArmed={timer.finishArmed}
          phase={
            timer.phaseIndex === null
              ? null
              : {
                  label: phases[timer.phaseIndex]?.label ?? '',
                  index: timer.phaseIndex,
                  count: phases.length,
                }
          }
          inspectionEnabled={timer.inspectionEnabled}
          touchHandlers={timer.touchHandlers}
        />

        {/* The phases of the solve just finished, under the time it produced. */}
        {resultVisible && lastSolve && lastSolve.splits.length > 0 ? (
          <PhaseBar splits={lastSolve.splits} phases={methodPhases} rawMs={lastSolve.rawMs} />
        ) : null}
      </div>

      {/* Mid-solve nobody aims for the numbers: any tap must stop the clock,
          and the release after it is swallowed here too. */}
      {status === 'running' || status === 'stopped' ? (
        <div className="timer-overlay" aria-hidden="true" {...timer.touchHandlers} />
      ) : null}

      <section className={isSolving ? 'solves-panel solves-panel--hidden' : 'solves-panel'}>
        <h2 className="solves-panel__title">
          {/* The session name doubles as the way into session switching. */}
          <button
            type="button"
            className="solves-panel__session"
            title={strings.sessions.switchSession}
            onClick={() => navigate('sessions')}
          >
            {session?.name ?? strings.appName}
          </button>
          · {solves.length}
          <span className="solves-panel__toggles">
            <label className="toggle solves-panel__toggle">
              <input
                type="checkbox"
                checked={timer.inspectionEnabled}
                onChange={(event) => timer.setInspectionEnabled(event.target.checked)}
              />
              {strings.timer.inspectionToggle}
            </label>
            <label className="toggle solves-panel__toggle">
              <input
                type="checkbox"
                checked={splitMode === 'phases'}
                disabled={methodPhases.length === 0}
                onChange={(event) => setSplitMode(event.target.checked ? 'phases' : 'total')}
              />
              {strings.timer.phaseToggle}
            </label>
          </span>
        </h2>
        <MiniStats sessionId={session?.id ?? null} puzzle={PUZZLE} />
        <SolveList solves={solves} onChangePenalty={handleChangePenalty} onDelete={handleDelete} />
      </section>
    </main>
  );
}
