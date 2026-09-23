import { describe, expect, it } from 'vitest';
import {
  currentPhaseIndex,
  initialTimerState,
  isArmed,
  isFinishArmed,
  timerReducer,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from './timer-machine';

const withInspection: TimerConfig = { holdThresholdMs: 300, inspectionEnabled: true, phases: [] };
const noInspection: TimerConfig = { holdThresholdMs: 300, inspectionEnabled: false, phases: [] };
const byPhase: TimerConfig = { ...noInspection, phases: ['cross', 'f2l', 'oll', 'pll'] };

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
    expect(state).toEqual({
      status: 'running',
      startedAt: 300,
      inspectionMs: null,
      splitMs: [],
      pressedAt: null,
    });
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
    expect(state).toEqual({ status: 'stopped', rawMs: 12_340, inspectionMs: null, splitMs: [] });
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
    expect(state).toEqual({
      status: 'running',
      startedAt: 8400,
      inspectionMs: 8300,
      splitMs: [],
      pressedAt: null,
    });
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

  it('keeps whole milliseconds, so the clock and the stored time agree', () => {
    const stopped = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 400.25 },
        { type: 'press', at: 2409.85 },
      ],
      noInspection,
    );
    // 2009.6 ms: stored as 2010, so the clock has to say 2.01 too, not 2.00.
    expect(stopped).toMatchObject({ status: 'stopped', rawMs: 2010 });
  });

  it('keeps whole milliseconds for the inspection and the phase boundaries', () => {
    const inspected = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 10.4 },
        { type: 'press', at: 5000 },
        { type: 'release', at: 5400.7 },
      ],
      withInspection,
    );
    expect(inspected).toMatchObject({ status: 'running', inspectionMs: 5390 });

    const split = timerReducer(
      timerReducer(
        run([{ type: 'press', at: 0 }, { type: 'release', at: 400 }], byPhase),
        { type: 'press', at: 1234.56 },
        byPhase,
      ),
      { type: 'release', at: 1250 },
      byPhase,
    );
    expect(split).toMatchObject({ status: 'running', splitMs: [835] });
  });

  it('forgets a hold the system took away, so a later tap is not a full hold', () => {
    const aborted = run(
      [
        { type: 'press', at: 0 },
        { type: 'abort', at: 500 },
        { type: 'press', at: 10_000 },
        { type: 'release', at: 10_020 },
      ],
      noInspection,
    );
    expect(aborted.status).toBe('idle');
  });

  it('goes back to inspecting, still counting, when a hold during inspection is taken away', () => {
    const aborted = run(
      [
        { type: 'press', at: 0 },
        { type: 'release', at: 50 },
        { type: 'press', at: 5000 },
        { type: 'abort', at: 5500 },
      ],
      withInspection,
    );
    expect(aborted).toEqual({ status: 'inspecting', inspectionStartedAt: 50 });
  });

  it.each<[string, TimerEvent[], TimerConfig, number, TimerState['status']]>([
    ['the press that stopped the solve', [
      { type: 'press', at: 0 },
      { type: 'release', at: 400 },
      { type: 'press', at: 5000 },
    ], noInspection, 5050, 'idle'],
    ['a quick phase press', [
      { type: 'press', at: 0 },
      { type: 'release', at: 400 },
      { type: 'press', at: 2000 },
    ], byPhase, 2050, 'running'],
    ['a held phase press', [
      { type: 'press', at: 0 },
      { type: 'release', at: 400 },
      { type: 'press', at: 2000 },
    ], byPhase, 2500, 'stopped'],
  ])('treats an abort of %s as its release', (_name, events, config, at, expected) => {
    const state = timerReducer(run(events, config), { type: 'abort', at }, config);
    expect(state.status).toBe(expected);
    if (state.status === 'running') expect(state.pressedAt).toBeNull();
  });

  it('keeps a stopped result when cancel arrives, so the solve is not lost', () => {
    const stopped: TimerState = { status: 'stopped', rawMs: 1234, inspectionMs: null, splitMs: [] };
    expect(timerReducer(stopped, { type: 'cancel' }, noInspection)).toBe(stopped);
  });

  it('is armed only once the threshold has passed', () => {
    const holding: TimerState = { status: 'holding', heldSince: 0, inspectionStartedAt: null };
    expect(isArmed(holding, 299, noInspection)).toBe(false);
    expect(isArmed(holding, 300, noInspection)).toBe(true);
    expect(isArmed(initialTimerState, 5000, noInspection)).toBe(false);
  });
});

/**
 * Start a phase solve and tap it through the given moments. A tap with no
 * release is the press still being down — that is where the machine sits
 * right after the last phase stops the clock.
 */
function runPhases(taps: [press: number, release?: number][]): TimerState {
  const events: TimerEvent[] = [
    { type: 'press', at: 0 },
    { type: 'release', at: 400 },
  ];
  for (const [press, release] of taps) {
    events.push({ type: 'press', at: press });
    if (release !== undefined) events.push({ type: 'release', at: release });
  }
  return run(events, byPhase);
}

describe('timerReducer by phase', () => {
  it('ends a phase on a tap and keeps the clock running', () => {
    const state = runPhases([[2400, 2450]]);
    expect(state).toEqual({
      status: 'running',
      startedAt: 400,
      inspectionMs: null,
      splitMs: [2000],
      pressedAt: null,
    });
  });

  it('stops on the tap that ends the last phase', () => {
    const state = runPhases([
      [2400, 2450],
      [10_400, 10_450],
      [14_400, 14_450],
      [20_400],
    ]);
    expect(state).toEqual({
      status: 'stopped',
      rawMs: 20_000,
      inspectionMs: null,
      splitMs: [2000, 10_000, 14_000],
    });
  });

  it('takes the boundary from the press, not the release that follows it', () => {
    const state = runPhases([[2400, 2900]]);
    // 500ms is past the hold threshold, so this one finished the solve early.
    expect(state).toEqual({
      status: 'stopped',
      rawMs: 2000,
      inspectionMs: null,
      splitMs: [],
    });
  });

  it('finishes early when a phase tap is held, keeping the splits already made', () => {
    const state = runPhases([
      [2400, 2450],
      [9400, 9800],
    ]);
    expect(state).toEqual({
      status: 'stopped',
      rawMs: 9000,
      inspectionMs: null,
      splitMs: [2000],
    });
  });

  it('records equal boundaries for a skipped phase, without any special case', () => {
    const state = runPhases([
      [2400, 2450],
      [10_400, 10_450],
      [10_400, 10_450],
    ]);
    expect(state).toMatchObject({ status: 'running', splitMs: [2000, 10_000, 10_000] });
  });

  it('stops immediately on the last phase however long the press is held', () => {
    const state = runPhases([
      [2400, 2450],
      [10_400, 10_450],
      [14_400, 14_450],
      [20_400],
    ]);
    expect(timerReducer(state, { type: 'release', at: 25_000 }, byPhase)).toMatchObject({
      status: 'idle',
      lastRawMs: 20_000,
    });
    expect(state).toMatchObject({ status: 'stopped', rawMs: 20_000 });
  });

  it('discards the whole attempt on cancel, splits included', () => {
    const running = runPhases([[2400, 2450]]);
    expect(timerReducer(running, { type: 'cancel' }, byPhase).status).toBe('idle');
  });

  it('names the phase being solved, and stays on the last one', () => {
    expect(currentPhaseIndex(runPhases([]), byPhase)).toBe(0);
    expect(currentPhaseIndex(runPhases([[2400, 2450]]), byPhase)).toBe(1);
    expect(currentPhaseIndex(initialTimerState, byPhase)).toBeNull();
    expect(currentPhaseIndex(runPhases([[2400, 2450]]), noInspection)).toBeNull();
  });

  it('arms the finish only once a phase press has been held long enough', () => {
    const pressed = timerReducer(runPhases([]), { type: 'press', at: 2400 }, byPhase);
    expect(isFinishArmed(pressed, 2699, byPhase)).toBe(false);
    expect(isFinishArmed(pressed, 2700, byPhase)).toBe(true);
    expect(isFinishArmed(runPhases([]), 9999, byPhase)).toBe(false);
  });
});
