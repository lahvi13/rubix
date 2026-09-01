import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  displayedMs,
  initialTimerState,
  inspectionElapsedMs,
  isArmed,
  timerReducer,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from '../../../domain/timer/timer-machine';
import { penaltyForInspection } from '../../../domain/solve/penalty';
import type { Penalty } from '../../../db/types';
import { monotonicNow } from '../../../lib/clock';
import { beep } from '../../../lib/beep';
import { SETTING_DEFAULTS, getSetting } from '../../../db/repositories/settings-repository';

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

/**
 * Drives the timer state machine from keyboard and pointer input and repaints
 * on animation frames. Nothing is written to the database from here — the
 * caller decides what to do with a finished attempt.
 */
export function useTimer(onComplete: (attempt: CompletedAttempt) => void): TimerView {
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<TimerState>(initialTimerState);
  const [frameAt, setFrameAt] = useState(() => monotonicNow());

  const configRef = useRef(config);
  const onCompleteRef = useRef(onComplete);
  const firedCues = useRef<Set<number>>(new Set());
  const cues = useRef<readonly number[]>(SETTING_DEFAULTS['timer.inspectionCues']);

  useEffect(() => {
    void Promise.all([
      getSetting('timer.holdThresholdMs'),
      getSetting('timer.inspectionEnabled'),
      getSetting('timer.inspectionCues'),
    ]).then(([holdThresholdMs, inspectionEnabled, inspectionCues]) => {
      setConfig({ holdThresholdMs, inspectionEnabled });
      cues.current = inspectionCues;
    });
  }, []);

  // Kept in refs so the event listeners never need re-binding, and assigned in
  // an effect because refs must not be written during render.
  useEffect(() => {
    configRef.current = config;
    onCompleteRef.current = onComplete;
  });

  const dispatch = useCallback((event: TimerEvent) => {
    setState((current) => timerReducer(current, event, configRef.current));
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
      if (event.code !== 'Space') return;
      event.preventDefault();
      releaseFocusedButton();
      dispatch({ type: 'press', at: monotonicNow() });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
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
    touchHandlers: {
      onPointerDown: (event: ReactPointerEvent) => {
        event.preventDefault();
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
 * Only text entry blocks the timer. Buttons deliberately do not: after tapping
 * the nav or any control, focus stays on that button, and treating it as a
 * typing target would silently swallow every space bar press from then on.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

/**
 * A focused button would otherwise be activated by the same space press that
 * starts the solve. preventDefault stops that, and dropping focus keeps the
 * button from reacting to later presses at all.
 */
function releaseFocusedButton(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.tagName === 'BUTTON') active.blur();
}
