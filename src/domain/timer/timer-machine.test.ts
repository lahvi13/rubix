import { describe, expect, it } from 'vitest';
import {
  initialTimerState,
  isArmed,
  timerReducer,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from './timer-machine';

const withInspection: TimerConfig = { holdThresholdMs: 300, inspectionEnabled: true };
const noInspection: TimerConfig = { holdThresholdMs: 300, inspectionEnabled: false };

function run(events: TimerEvent[], config: TimerConfig): TimerState {
  return events.reduce((state, event) => timerReducer(state, event, config), initialTimerState);
}

describe('timerReducer without inspection', () => {
  it('starts the solve when the hold was long enough', () => {
    const state = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 300 },
      ],
      noInspection,
    );
    expect(state).toEqual({ status: 'running', startedAt: 300, inspectionMs: null });
  });

  it('falls back to idle when released too early', () => {
    const state = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 299 },
      ],
      noInspection,
    );
    expect(state.status).toBe('idle');
  });

  it('stops on the next press and reports the elapsed time', () => {
    const state = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 400 },
        { type: 'press', at: 12_740 },
      ],
      noInspection,
    );
    expect(state).toEqual({ status: 'stopped', rawMs: 12_340, inspectionMs: null });
  });
});

describe('timerReducer with inspection', () => {
  it('enters inspection on a tap, without requiring a hold', () => {
    const state = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 10 },
      ],
      withInspection,
    );
    expect(state).toEqual({ status: 'inspecting', inspectionStartedAt: 10 });
  });

  it('measures inspection up to the moment the solve starts', () => {
    const state = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 100 },
        { type: 'press', at: 8000 },
        { type: 'release', at: 8400 },
      ],
      withInspection,
    );
    expect(state).toEqual({ status: 'running', startedAt: 8400, inspectionMs: 8300 });
  });

  it('returns to inspection when the hold was too short', () => {
    const state = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 100 },
        { type: 'press', at: 5000 },
        { type: 'release', at: 5100 },
      ],
      withInspection,
    );
    expect(state).toEqual({ status: 'inspecting', inspectionStartedAt: 100 });
  });
});

describe('timerReducer edge cases', () => {
  it('does not let the stopping press re-arm the timer', () => {
    const stopped = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 400 },
        { type: 'press', at: 5000 },
      ],
      noInspection,
    );
    expect(stopped.status).toBe('stopped');
    expect(timerReducer(stopped, { type: 'release', at: 5050 }, noInspection).status).toBe('idle');
  });

  it('discards a running attempt on cancel', () => {
    const running = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 400 },
      ],
      noInspection,
    );
    expect(timerReducer(running, { type: 'cancel' }, noInspection).status).toBe('idle');
  });

  it('keeps a stopped result when cancel arrives, so the solve is not lost', () => {
    const stopped: TimerState = { status: 'stopped', rawMs: 1234, inspectionMs: null };
    expect(timerReducer(stopped, { type: 'cancel' }, noInspection)).toBe(stopped);
  });

  it('is armed only once the threshold has passed', () => {
    const holding: TimerState = { status: 'holding', heldSince: 0, inspectionStartedAt: null };
    expect(isArmed(holding, 299, noInspection)).toBe(false);
    expect(isArmed(holding, 300, noInspection)).toBe(true);
    expect(isArmed(initialTimerState, 5000, noInspection)).toBe(false);
  });
});
