import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TimerState } from '../../../domain/timer/timer-machine';
import { INSPECTION_LIMIT_MS } from '../../../domain/solve/penalty';
import { formatInspection, formatMs } from '../../../lib/format';
import { strings } from '../../../lib/strings';

interface TimerDisplayProps {
  state: TimerState;
  displayMs: number | null;
  inspectionMs: number | null;
  armed: boolean;
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
  touchHandlers,
}: TimerDisplayProps) {
  const isInspecting = inspectionMs !== null;
  const modifier = armed ? 'armed' : state.status;

  return (
    <div
      className={`timer timer--${modifier}`}
      role="button"
      tabIndex={-1}
      aria-live="off"
      {...touchHandlers}
    >
      <div className="timer__value">
        {isInspecting
          ? formatInspection(inspectionMs, INSPECTION_LIMIT_MS)
          : formatMs(displayMs ?? 0)}
      </div>
      <p className="timer__hint">{hintFor(state, armed)}</p>
    </div>
  );
}

function hintFor(state: TimerState, armed: boolean): string {
  if (armed) return strings.timer.releaseToStart;
  if (state.status === 'inspecting') return strings.timer.holdToStartInspection;
  if (state.status === 'running') return '';
  return strings.timer.holdToStart;
}
