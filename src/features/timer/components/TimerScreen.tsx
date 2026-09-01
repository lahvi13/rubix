import { useCallback } from 'react';
import { addSolve } from '../../../db/repositories/solve-repository';
import { now } from '../../../lib/clock';
import { strings } from '../../../lib/strings';
import { useActiveSession } from '../../sessions';
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
      if (!session || scramble.scramble === null) return;

      void addSolve({
        sessionId: session.id,
        puzzle: PUZZLE,
        mode: MODE,
        scramble: scramble.scramble,
        rawMs: attempt.rawMs,
        penalty: attempt.penalty,
        // Anything set at this point came from the inspection rules, not the user.
        penaltySource: 'auto',
        inspectionMs: attempt.inspectionMs,
        startedAt: now() - Math.round(attempt.rawMs),
      }).then(() => {
        scramble.next();
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
          {session?.name ?? strings.appName} · {solves.length}
        </h2>
        <SolveList
          solves={solves}
          onChangePenalty={(id, penalty) => void changePenalty(id, penalty)}
          onDelete={(id) => void remove(id)}
        />
      </section>
    </main>
  );
}
