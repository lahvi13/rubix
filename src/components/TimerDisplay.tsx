import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TimerState } from '../domain/timer/timer-machine';
import { INSPECTION_LIMIT_MS } from '../domain/solve/penalty';
import { formatInspection, formatMsParts } from '../lib/format';
import { strings } from '../lib/strings';

interface TimerDisplayProps {
  state: TimerState;
  displayMs: number | null;
  inspectionMs: number | null;
  armed: boolean;
  /** A phase press held long enough that releasing it ends the solve. */
  finishArmed?: boolean;
  /** Guided solve: which phase is being solved, and how many there are. */
  phase?: { label: string; index: number; count: number } | null;
  inspectionEnabled: boolean;
  touchHandlers: {
    onPointerDown: (event: ReactPointerEvent) => void;
    onPointerUp: (event: ReactPointerEvent) => void;
  };
}

export function TimerDisplay({
  state,
  displayMs,
  inspectionMs,
  armed,
  finishArmed = false,
  phase = null,
  inspectionEnabled,
  touchHandlers,
}: TimerDisplayProps) {
  const isInspecting = inspectionMs !== null;
  const modifier = armed || finishArmed ? 'armed' : state.status;

  return (
    <div
      className={`timer timer--${modifier}`}
      role="button"
      tabIndex={-1}
      aria-live="off"
      {...touchHandlers}
    >
      {/* The role is what a clock is, and it is how a test asks what it reads;
          announcements stay off, or every frame would be read out. */}
      <div className="timer__value" role="timer">
        {isInspecting ? (
          formatInspection(inspectionMs, INSPECTION_LIMIT_MS)
        ) : (
          <Time ms={displayMs ?? 0} />
        )}
      </div>
      {/* The phase name is the whole point of the guided run: without it the
          taps have to be counted in your head. It is the only thing the run
          shows besides the clock. */}
      {phase ? (
        <p className="timer__phase">
          {phase.label} <span className="timer__phase-count">{phase.index + 1}/{phase.count}</span>
        </p>
      ) : null}
      <p className="timer__hint">{hintFor(state, armed, finishArmed, phase !== null, inspectionEnabled)}</p>
    </div>
  );
}

/**
 * The seconds are read while the cube is still in hand; the hundredths are
 * read afterwards, so they are quieter and take less room.
 */
function Time({ ms }: { ms: number }) {
  const { seconds, hundredths } = formatMsParts(ms);
  return (
    <>
      {seconds}
      <span className="timer__hundredths">.{hundredths}</span>
    </>
  );
}

/** The hint must describe what the CURRENT gesture will do, stage by stage. */
function hintFor(
  state: TimerState,
  armed: boolean,
  finishArmed: boolean,
  byPhase: boolean,
  inspectionEnabled: boolean,
): string {
  if (armed) return strings.timer.releaseToStart;
  if (finishArmed) return strings.timer.releaseToFinish;
  if (state.status === 'running') return byPhase ? strings.timer.tapToEndPhase : '';
  if (state.status === 'inspecting') return strings.timer.holdToStartInspection;
  if (state.status === 'holding') {
    if (state.inspectionStartedAt !== null) return strings.timer.holdToStartInspection;
    return inspectionEnabled ? strings.timer.releaseToInspect : strings.timer.holdToStart;
  }
  return inspectionEnabled ? strings.timer.inspectionHint : strings.timer.holdToStart;
}
