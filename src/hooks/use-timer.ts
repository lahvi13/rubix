import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  displayedMs,
  initialTimerState,
  inspectionElapsedMs,
  isArmed,
  timerReducer,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from '../domain/timer/timer-machine';
import { penaltyForInspection } from '../domain/solve/penalty';
import type { Penalty } from '../db/types';
import { monotonicNow } from '../lib/clock';
import { beep, primeBeep } from '../lib/beep';
import { SETTING_DEFAULTS, getSetting, setSetting } from '../db/repositories/settings-repository';

export interface CompletedAttempt {
  rawMs: number;
  inspectionMs: number | null;
  penalty: Penalty;
}

export interface TimerView {
  state: TimerState;
  /** Time to render, in milliseconds; null while inspecting or idle with no result yet. */
  displayMs: number | null;
  inspectionMs: number | null;
  armed: boolean;
  inspectionEnabled: boolean;
  setInspectionEnabled: (enabled: boolean) => void;
  /** Spread onto the touch surface; the keyboard is wired up globally. */
  touchHandlers: {
    onPointerDown: (event: ReactPointerEvent) => void;
    onPointerUp: (event: ReactPointerEvent) => void;
  };
}

const DEFAULT_CONFIG: TimerConfig = {
  holdThresholdMs: SETTING_DEFAULTS['timer.holdThresholdMs'],
  inspectionEnabled: SETTING_DEFAULTS['timer.inspectionEnabled'],
};

export interface TimerOptions {
  /**
   * 'off' ignores the inspection setting for this timer. The drill uses it:
   * fifteen seconds of WCA inspection over a three-second PLL is not what is
   * being trained, and the automatic +2 past fifteen would fire on every
   * attempt where somebody thought about the case.
   */
  inspection?: 'setting' | 'off';
}

/**
 * Drives the timer state machine from keyboard and pointer input and repaints
 * on animation frames. Nothing is written to the database from here — the
 * caller decides what to do with a finished attempt.
 */
export function useTimer(
  onComplete: (attempt: CompletedAttempt) => void,
  options: TimerOptions = {},
): TimerView {
  const [state, setState] = useState<TimerState>(initialTimerState);
  const [frameAt, setFrameAt] = useState(() => monotonicNow());

  // Live, so toggling inspection on the timer screen applies immediately.
  const settings = useLiveQuery(
    async () => ({
      holdThresholdMs: await getSetting('timer.holdThresholdMs'),
      inspectionEnabled: await getSetting('timer.inspectionEnabled'),
      inspectionCues: await getSetting('timer.inspectionCues'),
    }),
    [],
  );
  const config: TimerConfig = {
    holdThresholdMs: settings?.holdThresholdMs ?? DEFAULT_CONFIG.holdThresholdMs,
    inspectionEnabled:
      options.inspection === 'off'
        ? false
        : (settings?.inspectionEnabled ?? DEFAULT_CONFIG.inspectionEnabled),
  };

  const configRef = useRef(config);
  const stateRef = useRef(state);
  const onCompleteRef = useRef(onComplete);
  const firedCues = useRef<Set<number>>(new Set());
  const cues = useRef<readonly number[]>(SETTING_DEFAULTS['timer.inspectionCues']);

  // Kept in refs so the event listeners never need re-binding, and assigned in
  // an effect because refs must not be written during render.
  useEffect(() => {
    configRef.current = config;
    stateRef.current = state;
    onCompleteRef.current = onComplete;
    if (settings) cues.current = settings.inspectionCues;
  });

  const dispatch = useCallback((event: TimerEvent) => {
    setState((current) => timerReducer(current, event, configRef.current));
  }, []);

  const setInspectionEnabled = useCallback((enabled: boolean) => {
    void setSetting('timer.inspectionEnabled', enabled);
  }, []);

  // A finished attempt leaves the machine through 'stopped' exactly once.
  useEffect(() => {
    if (state.status !== 'stopped') return;
    onCompleteRef.current({
      rawMs: state.rawMs,
      inspectionMs: state.inspectionMs,
      penalty: penaltyForInspection(state.inspectionMs),
    });
  }, [state]);

  // Repaint while something is moving; idle and stopped states are static.
  useEffect(() => {
    const isLive =
      state.status === 'running' || state.status === 'inspecting' || state.status === 'holding';
    if (!isLive) return;

    let handle = 0;
    const loop = () => {
      const at = monotonicNow();
      setFrameAt(at);

      const elapsed = inspectionElapsedMs(state, at);
      if (elapsed !== null) {
        for (const cue of cues.current) {
          if (elapsed >= cue && !firedCues.current.has(cue)) {
            firedCues.current.add(cue);
            beep();
          }
        }
      }
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, [state]);

  useEffect(() => {
    if (state.status === 'idle') firedCues.current.clear();
  }, [state.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target)) return;
      if (event.code === 'Escape') {
        dispatch({ type: 'cancel' });
        return;
      }
      // A running solve stops on ANY key (SPEC 3.1) — mid-solve nobody aims.
      if (stateRef.current.status === 'running') {
        event.preventDefault();
        dispatch({ type: 'press', at: monotonicNow() });
        return;
      }
      if (event.code !== 'Space') return;
      event.preventDefault();
      releaseFocusedControl();
      // A key press is a user gesture — the right moment to wake Web Audio,
      // so the 8s/12s cues only schedule a tone instead of creating a context
      // mid animation frame.
      primeBeep();
      dispatch({ type: 'press', at: monotonicNow() });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      // The key that stopped the solve may not have been Space; its release
      // must still end the attempt, or the machine stays parked in 'stopped'.
      if (event.code !== 'Space' && stateRef.current.status !== 'stopped') return;
      event.preventDefault();
      dispatch({ type: 'release', at: monotonicNow() });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dispatch]);

  return {
    state,
    displayMs: displayedMs(state, frameAt),
    inspectionMs: inspectionElapsedMs(state, frameAt),
    armed: isArmed(state, frameAt, config),
    inspectionEnabled: config.inspectionEnabled,
    setInspectionEnabled,
    touchHandlers: {
      onPointerDown: (event: ReactPointerEvent) => {
        event.preventDefault();
        primeBeep();
        dispatch({ type: 'press', at: monotonicNow() });
      },
      onPointerUp: (event: ReactPointerEvent) => {
        event.preventDefault();
        dispatch({ type: 'release', at: monotonicNow() });
      },
    },
  };
}

/**
 * Only text entry blocks the timer. Buttons and toggles deliberately do not:
 * after tapping the nav or a checkbox, focus stays on that control, and
 * treating it as a typing target would silently swallow every space bar press
 * from then on.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'range'].includes(target.type);
  }
  return target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * A focused button or checkbox would otherwise be activated by the same space
 * press that starts the solve. preventDefault stops that, and dropping focus
 * keeps the control from reacting to later presses at all.
 */
function releaseFocusedControl(): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;
  if (active.tagName === 'BUTTON' || active instanceof HTMLInputElement) active.blur();
}
