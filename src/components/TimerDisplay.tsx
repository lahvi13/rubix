import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TimerState } from '../domain/timer/timer-machine';
import { INSPECTION_LIMIT_MS } from '../domain/solve/penalty';
import { useHasKeyboard } from '../hooks/use-has-keyboard';
import { formatInspection, formatMsParts } from '../lib/format';
import { strings } from '../lib/strings';

/**
 * What the finished time turned out to be worth, ready to be read: the tier
 * decides how loudly it is drawn, the mark and the label say what it is.
 * Resolved by the caller, which is the only one that knows the method's phase
 * names and the goal being chased.
 */
export interface TimerNote {
  /** A record of some size, or — quieter, and only failing one — a beaten goal. */
  tier: 'pb' | 'session' | 'phase' | 'goal';
  mark: string;
  label: string;
}

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
  /**
   * What that finished time was worth, if anything. Only read while
   * `resultShown`: on any other stage of the attempt it would describe a
   * solve that is no longer on the clock.
   */
  note?: TimerNote | null;
  /**
   * No new attempt can be started from here. The time stays on the clock — it
   * is what the attempt was for — but the surface stops offering to start
   * another one, and the hint says where the way on is instead.
   */
  locked?: boolean;
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
  note = null,
  locked = false,
  inspectionCues = [],
  inspectionEnabled,
  touchHandlers,
}: TimerDisplayProps) {
  const isInspecting = inspectionMs !== null;
  const hasKeyboard = useHasKeyboard();
  const modifier = armed || finishArmed ? 'armed' : state.status;

  return (
    <div
      className={locked ? `timer timer--${modifier} is-locked` : `timer timer--${modifier}`}
      role="button"
      tabIndex={-1}
      aria-disabled={locked || undefined}
      aria-live="off"
      {...touchHandlers}
    >
      <div
        className="timer__clock"
        style={isInspecting ? { color: inspectionColour(inspectionMs, inspectionCues) } : undefined}
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
        {isInspecting ? <InspectionBar elapsedMs={inspectionMs} /> : null}
      </div>
      {/* One line, two jobs: what the next gesture will do while there is one
          to describe, and what the time that has landed is worth once there
          is not. The same line either way, so a note does not push the
          screen about at the moment it is being read. */}
      <p className="timer__hint">
        {resultShown ? (
          note === null || note === undefined ? (
            ''
          ) : (
            <span className={`timer__note is-${note.tier}`}>
              <span aria-hidden="true">{note.mark} </span>
              {note.label}
            </span>
          )
        ) : locked ? (
          strings.timer.locked
        ) : (
          hintFor(state, armed, finishArmed, byPhase, inspectionEnabled, hasKeyboard)
        )}
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

/**
 * Inspection, as a bar that empties under the number. The number says how many
 * seconds are left; the bar says it without being read, which is the point
 * while a cube is being turned over in both hands.
 *
 * A bar rather than a ring around the digits: the clock can be set in a
 * seven-segment face half again as wide, at any of three sizes, and a ring
 * that fits one of those combinations runs into the rest.
 *
 * The colour comes from the clock above it, which changes on the cues — the
 * same thresholds the beeps use — so nothing on screen disagrees about how
 * much trouble the reader is in.
 */
function InspectionBar({ elapsedMs }: { elapsedMs: number }) {
  const left = Math.min(Math.max(1 - elapsedMs / INSPECTION_LIMIT_MS, 0), 1);

  return (
    <div className="timer__countdown" aria-hidden="true">
      <span className="timer__countdown-left" style={{ transform: `scaleX(${left})` }} />
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
  hasKeyboard: boolean,
): string {
  const gesture = hasKeyboard ? strings.timer.keys : strings.timer;
  if (armed) return strings.timer.releaseToStart;
  if (finishArmed) return strings.timer.releaseToFinish;
  if (state.status === 'running') return byPhase ? gesture.tapToEndPhase : '';
  if (state.status === 'inspecting') return gesture.holdToStartInspection;
  if (state.status === 'holding') {
    if (state.inspectionStartedAt !== null) return gesture.holdToStartInspection;
    return inspectionEnabled ? strings.timer.releaseToInspect : gesture.holdToStart;
  }
  return inspectionEnabled ? gesture.inspectionHint : gesture.holdToStart;
}
