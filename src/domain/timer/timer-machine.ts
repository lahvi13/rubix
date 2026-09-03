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
  /**
   * Phases of the guided solve, in method order. Empty means the plain timer:
   * one press stops the clock. With phases, a press ends the phase in progress
   * and the last one stops the clock.
   */
  phases: readonly string[];
}

export type TimerState =
  /** lastRawMs keeps the finished time on screen until the next attempt starts. */
  | { status: 'idle'; lastRawMs: number | null }
  | { status: 'inspecting'; inspectionStartedAt: number }
  | { status: 'holding'; heldSince: number; inspectionStartedAt: number | null }
  | {
      status: 'running';
      startedAt: number;
      inspectionMs: number | null;
      /** Phase boundaries so far, as offsets from startedAt. */
      splitMs: readonly number[];
      /**
       * When a phase-ending press is down but not yet resolved: releasing it
       * quickly moves to the next phase, holding it finishes the solve.
       */
      pressedAt: number | null;
    }
  | {
      status: 'stopped';
      rawMs: number;
      inspectionMs: number | null;
      splitMs: readonly number[];
    };

export type TimerEvent =
  | { type: 'press'; at: number }
  | { type: 'release'; at: number }
  /** ESC — abandon the attempt without recording it, splits included. */
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
          ? startRunning(event.at, null)
          : initialTimerState;
      }

      if (!heldLongEnough(state.heldSince, event.at, config)) {
        return { status: 'inspecting', inspectionStartedAt: state.inspectionStartedAt };
      }
      return startRunning(event.at, event.at - state.inspectionStartedAt);
    }

    case 'running': {
      if (event.type === 'press') {
        if (state.pressedAt !== null) return state;
        // In the last phase (and in the plain timer, which is all last phase)
        // the press itself ends the solve, so the clock freezes on the way
        // down exactly as it always has.
        if (isFinalPhase(state, config)) return stopAt(state, event.at);
        return { ...state, pressedAt: event.at };
      }

      if (state.pressedAt === null) return state;
      // A press held past the threshold finishes the solve wherever it is —
      // an OLL or PLL skip must not force taps through phases that never
      // happened. The time is taken from the press, not this release, so
      // holding costs nothing.
      if (heldLongEnough(state.pressedAt, event.at, config)) {
        return stopAt(state, state.pressedAt);
      }
      return {
        ...state,
        splitMs: [...state.splitMs, state.pressedAt - state.startedAt],
        pressedAt: null,
      };
    }

    case 'stopped':
      // The press that stopped the timer is still down. Only its release ends
      // the attempt, so that one keystroke cannot both stop and re-arm.
      return event.type === 'release' ? { status: 'idle', lastRawMs: state.rawMs } : state;
  }
}

function startRunning(at: number, inspectionMs: number | null): TimerState {
  return { status: 'running', startedAt: at, inspectionMs, splitMs: [], pressedAt: null };
}

function stopAt(
  state: Extract<TimerState, { status: 'running' }>,
  at: number,
): TimerState {
  return {
    status: 'stopped',
    rawMs: at - state.startedAt,
    inspectionMs: state.inspectionMs,
    splitMs: state.splitMs,
  };
}

function isFinalPhase(
  state: Extract<TimerState, { status: 'running' }>,
  config: TimerConfig,
): boolean {
  return config.phases.length === 0 || state.splitMs.length + 1 >= config.phases.length;
}

function heldLongEnough(heldSince: number, at: number, config: TimerConfig): boolean {
  return at - heldSince >= config.holdThresholdMs;
}

/** Held long enough that releasing will start the solve — the green state. */
export function isArmed(state: TimerState, at: number, config: TimerConfig): boolean {
  return state.status === 'holding' && heldLongEnough(state.heldSince, at, config);
}

/** Held long enough that releasing will end a phase solve early. */
export function isFinishArmed(state: TimerState, at: number, config: TimerConfig): boolean {
  if (state.status !== 'running' || state.pressedAt === null) return false;
  return heldLongEnough(state.pressedAt, at, config);
}

/** Which phase of the method is being solved right now, or null outside a run. */
export function currentPhaseIndex(state: TimerState, config: TimerConfig): number | null {
  if (state.status !== 'running' || config.phases.length === 0) return null;
  return Math.min(state.splitMs.length, config.phases.length - 1);
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
