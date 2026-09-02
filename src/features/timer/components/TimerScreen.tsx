import { useCallback } from 'react';
import { addSolve } from '../../../db/repositories/solve-repository';
import { now } from '../../../lib/clock';
import { strings } from '../../../lib/strings';
import { navigate } from '../../../app/router';
import { reportError } from '../../../lib/errors';
import { useActiveSession } from '../../sessions';
import { MiniStats } from '../../stats';
import { useRecentSolves } from '../hooks/use-recent-solves';
import { useScramble } from '../hooks/use-scramble';
import { useTimer, type CompletedAttempt } from '../hooks/use-timer';
import { ScramblePanel } from './ScramblePanel';
import { SolveList } from './SolveList';
import { TimerDisplay } from './TimerDisplay';

const PUZZLE = '333';
const MODE = 'freestyle';

export function TimerScreen() {
  const session = useActiveSession(PUZZLE, MODE);
  const scramble = useScramble(PUZZLE);
  const { solves, changePenalty, remove } = useRecentSolves(session?.id ?? null);

  const handleComplete = useCallback(
    (attempt: CompletedAttempt) => {
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
      })
        .then(() => {
          scramble.next();
        })
        .catch((cause: unknown) => {
          reportError(strings.errors.saveSolve, cause);
        });
    },
    [session, scramble],
  );

  const timer = useTimer(handleComplete);
  const isSolving = timer.state.status === 'running';

  return (
    <main className="screen">
      <ScramblePanel
        scramble={scramble.scramble}
        error={scramble.error}
        onRetry={scramble.next}
        hidden={isSolving}
      />

      <TimerDisplay
        state={timer.state}
        displayMs={timer.displayMs}
        inspectionMs={timer.inspectionMs}
        armed={timer.armed}
        touchHandlers={timer.touchHandlers}
      />

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
        </h2>
        <MiniStats sessionId={session?.id ?? null} puzzle={PUZZLE} />
        <SolveList
          solves={solves}
          onChangePenalty={(id, penalty) => void changePenalty(id, penalty)}
          onDelete={(id) => void remove(id)}
        />
      </section>
    </main>
  );
}
