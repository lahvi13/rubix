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
/**
   * Whether this is a guided run, which changes what a tap does and so what
   * the hint has to say. Which phase it is on is drawn under the clock by the
   * phase strip, not here.
   */
  byPhase?: boolean;
  /**
   * A finished time is on the clock and the screen is offering the next
   * scramble. The hint would be describing the solve that is already over.
   */
  resultShown?: boolean;
  /** When inspection beeps, in elapsed milliseconds; the ring changes with them. */
  inspectionCues?: readonly number[];
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
  byPhase = false,
  resultShown = false,
  inspectionCues = [],
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
      <div
        className="timer__clock"
        style={isInspecting ? { color: inspectionColour(inspectionMs, inspectionCues) } : undefined}
      >
        {isInspecting ? <InspectionRing elapsedMs={inspectionMs} /> : null}
        {/* The role is what a clock is, and it is how a test asks what it reads;
            announcements stay off, or every frame would be read out. */}
        <div className="timer__value" role="timer">
          {isInspecting ? (
            formatInspection(inspectionMs, INSPECTION_LIMIT_MS)
          ) : (
            <Time ms={displayMs ?? 0} />
          )}
        </div>
      </div>
      <p className="timer__hint">
        {resultShown ? '' : hintFor(state, armed, finishArmed, byPhase, inspectionEnabled)}
      </p>
    </div>
  );
}

/** The cues are elapsed thresholds; past the last one, inspection is nearly up. */
function inspectionColour(elapsedMs: number, cues: readonly number[]): string {
  const [first, second] = cues;
  if (second !== undefined && elapsedMs >= second) return 'var(--danger)';
  if (first !== undefined && elapsedMs >= first) return 'var(--warn)';
  return 'var(--accent)';
}

const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * Inspection, as a ring that empties. The number says how many seconds are
 * left; the ring says it without being read, which is the point while a cube
 * is being turned over in both hands.
 *
 * The colour comes from the clock around it, which changes on the cues — the
 * same thresholds the beeps use — so nothing on screen disagrees about how
 * much trouble the reader is in.
 */
function InspectionRing({ elapsedMs }: { elapsedMs: number }) {
  const left = Math.min(Math.max(1 - elapsedMs / INSPECTION_LIMIT_MS, 0), 1);

  return (
    <svg className="timer__ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle className="timer__ring-track" cx="50" cy="50" r={RING_RADIUS} />
      <circle
        className="timer__ring-left"
        cx="50"
        cy="50"
        r={RING_RADIUS}
        style={{
          strokeDasharray: RING_LENGTH,
          strokeDashoffset: RING_LENGTH * (1 - left),
        }}
      />
    </svg>
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
