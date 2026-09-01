/**
 * Pure timer state machine. Lives in the domain so the whole hold / inspect /
 * run / stop dance is testable without a DOM, a key event or a real clock:
 * every event carries the timestamp instead of reading one.
 *
 * All timestamps come from performance.now() — never Date.now(), which can
 * jump backwards when the system clock is adjusted mid-solve.
 */

export interface TimerConfig {
  holdThresholdMs: number;
  inspectionEnabled: boolean;
}

export type TimerState =
  /** lastRawMs keeps the finished time on screen until the next attempt starts. */
  | { status: 'idle'; lastRawMs: number | null }
  | { status: 'inspecting'; inspectionStartedAt: number }
  | { status: 'holding'; heldSince: number; inspectionStartedAt: number | null }
  | { status: 'running'; startedAt: number; inspectionMs: number | null }
  | { status: 'stopped'; rawMs: number; inspectionMs: number | null };

export type TimerEvent =
  | { type: 'press'; at: number }
  | { type: 'release'; at: number }
  /** ESC — abandon the attempt without recording it. */
  | { type: 'cancel' }
  /** The stopped solve has been dealt with; back to idle. */
  | { type: 'reset' };

export const initialTimerState: TimerState = { status: 'idle', lastRawMs: null };

export function timerReducer(
  state: TimerState,
  event: TimerEvent,
  config: TimerConfig,
): TimerState {
  if (event.type === 'reset') return initialTimerState;
  if (event.type === 'cancel') {
    return state.status === 'stopped' ? state : initialTimerState;
  }

  switch (state.status) {
    case 'idle':
      if (event.type === 'press') {
        return { status: 'holding', heldSince: event.at, inspectionStartedAt: null };
      }
      return state;

    case 'inspecting':
      if (event.type === 'press') {
        return {
          status: 'holding',
          heldSince: event.at,
          inspectionStartedAt: state.inspectionStartedAt,
        };
      }
      return state;

    case 'holding': {
      if (event.type !== 'release') return state;

      // Inspection starts on a plain tap; only the solve itself needs the hold.
      if (state.inspectionStartedAt === null) {
        if (config.inspectionEnabled) {
          return { status: 'inspecting', inspectionStartedAt: event.at };
        }
        return heldLongEnough(state.heldSince, event.at, config)
          ? { status: 'running', startedAt: event.at, inspectionMs: null }
          : initialTimerState;
      }

      if (!heldLongEnough(state.heldSince, event.at, config)) {
        return { status: 'inspecting', inspectionStartedAt: state.inspectionStartedAt };
      }
      return {
        status: 'running',
        startedAt: event.at,
        inspectionMs: event.at - state.inspectionStartedAt,
      };
    }

    case 'running':
      if (event.type === 'press') {
        return {
          status: 'stopped',
          rawMs: event.at - state.startedAt,
          inspectionMs: state.inspectionMs,
        };
      }
      return state;

    case 'stopped':
      // The press that stopped the timer is still down. Only its release ends
      // the attempt, so that one keystroke cannot both stop and re-arm.
      return event.type === 'release' ? { status: 'idle', lastRawMs: state.rawMs } : state;
  }
}

function heldLongEnough(heldSince: number, at: number, config: TimerConfig): boolean {
  return at - heldSince >= config.holdThresholdMs;
}

/** Held long enough that releasing will start the solve — the green state. */
export function isArmed(state: TimerState, at: number, config: TimerConfig): boolean {
  return state.status === 'holding' && heldLongEnough(state.heldSince, at, config);
}

/** Milliseconds shown on screen for the current state, or null when there is nothing to show. */
export function displayedMs(state: TimerState, at: number): number | null {
  if (state.status === 'running') return at - state.startedAt;
  if (state.status === 'stopped') return state.rawMs;
  if (state.status === 'idle') return state.lastRawMs;
  return null;
}

/** Elapsed inspection time, counting up. */
export function inspectionElapsedMs(state: TimerState, at: number): number | null {
  if (state.status === 'inspecting') return at - state.inspectionStartedAt;
  if (state.status === 'holding' && state.inspectionStartedAt !== null) {
    return at - state.inspectionStartedAt;
  }
  return null;
}
