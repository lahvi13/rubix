import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  currentPhaseIndex,
  displayedMs,
  initialTimerState,
  inspectionElapsedMs,
  isArmed,
  isFinishArmed,
  timerReducer,
  type TimerConfig,
  type TimerEvent,
  type TimerState,
} from '../domain/timer/timer-machine';
import { penaltyForInspection } from '../domain/solve/penalty';
import type { Penalty } from '../db/types';
import { eventTime, monotonicNow } from '../lib/clock';
import { beep, primeBeep } from '../lib/beep';
import { isTypingTarget } from '../lib/typing-target';
import { useStayAwake } from './use-stay-awake';
import { SETTING_DEFAULTS, getSetting, setSetting } from '../db/repositories/settings-repository';

export interface CompletedAttempt {
  rawMs: number;
  inspectionMs: number | null;
  penalty: Penalty;
  /** Phase boundaries as offsets from the start; empty unless the solve was guided. */
  splitMs: readonly number[];
}

export interface TimerView {
  state: TimerState;
  /** Time to render, in milliseconds; null while inspecting or idle with no result yet. */
  displayMs: number | null;
  inspectionMs: number | null;
  armed: boolean;
  /** A phase press has been held long enough that releasing it finishes the solve. */
  finishArmed: boolean;
  /** Index into the configured phases, or null outside a guided run. */
  phaseIndex: number | null;
  inspectionEnabled: boolean;
  /** No new attempt can be started; see TimerOptions.locked. */
  isLocked: boolean;
  /** When inspection beeps, in elapsed ms. The countdown is drawn from these too. */
  inspectionCues: readonly number[];
  setInspectionEnabled: (enabled: boolean) => void;
  /**
   * Back to a blank clock. The time of a finished attempt stays up until the
   * next one starts, but only while it still refers to what is on screen —
   * moving on to another scramble or another case has to clear it, or the
   * number ends up describing something the user is no longer looking at.
   */
  reset: () => void;
  /**
   * Spread onto the touch surface; the keyboard is wired up globally. Inert
   * while the timer is locked, so the surface goes back to being page.
   */
  touchHandlers: {
    onPointerDown: (event: ReactPointerEvent) => void;
    onPointerUp: (event: ReactPointerEvent) => void;
    onPointerCancel: (event: ReactPointerEvent) => void;
  };
}

const NO_PHASES: readonly string[] = [];

const DEFAULT_CONFIG: TimerConfig = {
  holdThresholdMs: SETTING_DEFAULTS['timer.holdThresholdMs'],
  inspectionEnabled: SETTING_DEFAULTS['timer.inspectionEnabled'],
  phases: NO_PHASES,
};

export interface TimerOptions {
  /**
   * 'off' ignores the inspection setting for this timer. The drill uses it:
   * fifteen seconds of WCA inspection over a three-second PLL is not what is
   * being trained, and the automatic +2 past fifteen would fire on every
   * attempt where somebody thought about the case.
   */
  inspection?: 'setting' | 'off';
  /**
   * Phase keys of the guided solve, in method order. Empty (the default) is
   * the plain timer: one press stops the clock.
   */
  phases?: readonly string[];
  /**
   * No new attempt may be started. The drill locks the clock once the case is
   * on show: a second time on a case whose answer you have just read is not a
   * time, and it would go into that case's numbers as though it were.
   *
   * Only starting is refused. A release still reaches the machine, or the
   * attempt that just finished would be left parked mid-press.
   */
  locked?: boolean;
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
  useStayAwake(state.status);

  // Live, so toggling inspection on the timer screen applies immediately.
  const settings = useLiveQuery(
    async () => ({
      holdThresholdMs: await getSetting('timer.holdThresholdMs'),
      inspectionEnabled: await getSetting('timer.inspectionEnabled'),
      inspectionCues: await getSetting('timer.inspectionCues'),
    }),
    [],
  );
  const phases = options.phases ?? NO_PHASES;
  const config: TimerConfig = {
    holdThresholdMs: settings?.holdThresholdMs ?? DEFAULT_CONFIG.holdThresholdMs,
    inspectionEnabled:
      options.inspection === 'off'
        ? false
        : (settings?.inspectionEnabled ?? DEFAULT_CONFIG.inspectionEnabled),
    phases,
  };

  const isLocked = options.locked ?? false;

  const configRef = useRef(config);
  const lockedRef = useRef(isLocked);
  const stateRef = useRef(state);
  const onCompleteRef = useRef(onComplete);
  const firedCues = useRef<Set<number>>(new Set());
  /**
   * The fingers on the surface. A cuber rests both hands on the phone the way
   * they would on a mat, and the attempt belongs to the pair: it is pressed
   * with the first finger down and released with the last one up — lifting
   * one hand used to start the clock while the other was still on the cube.
   */
  const pointers = useRef<Set<number>>(new Set());
  const cues = useRef<readonly number[]>(SETTING_DEFAULTS['timer.inspectionCues']);

  // Kept in refs so the event listeners never need re-binding, and assigned in
  // an effect because refs must not be written during render.
  useEffect(() => {
    configRef.current = config;
    lockedRef.current = isLocked;
    stateRef.current = state;
    onCompleteRef.current = onComplete;
    if (settings) cues.current = settings.inspectionCues;
  });

  const dispatch = useCallback((event: TimerEvent) => {
    if (lockedRef.current && event.type === 'press') return;
    setState((current) => timerReducer(current, event, configRef.current));
  }, []);

  const setInspectionEnabled = useCallback((enabled: boolean) => {
    void setSetting('timer.inspectionEnabled', enabled);
  }, []);

  const reset = useCallback(() => dispatch({ type: 'reset' }), [dispatch]);

  // A finished attempt leaves the machine through 'stopped' exactly once.
  useEffect(() => {
    if (state.status !== 'stopped') return;
    onCompleteRef.current({
      rawMs: state.rawMs,
      inspectionMs: state.inspectionMs,
      penalty: penaltyForInspection(state.inspectionMs),
      splitMs: state.splitMs,
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
        dispatch({ type: 'press', at: eventTime(event.timeStamp) });
        return;
      }
      if (event.code !== 'Space') return;
      event.preventDefault();
      releaseFocusedControl();
      // A key press is a user gesture — the right moment to wake Web Audio,
      // so the 8s/12s cues only schedule a tone instead of creating a context
      // mid animation frame.
      primeBeep();
      dispatch({ type: 'press', at: eventTime(event.timeStamp) });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      // The key that ended a phase or stopped the solve may not have been
      // Space, and its release still has to reach the machine — otherwise the
      // attempt stays parked in 'stopped', or worse, mid-phase with a press
      // that never resolves and a clock nothing but ESC can stop.
      if (event.code !== 'Space' && !awaitingRelease(stateRef.current)) return;
      event.preventDefault();
      dispatch({ type: 'release', at: eventTime(event.timeStamp) });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [dispatch]);

  // A finger the surface never heard lift — it was unmounted under it, or
  // the lift landed somewhere else — would otherwise stay counted for good,
  // and every later touch would be taken for a second finger. Registered on
  // the window, so it runs after the surface's own handler has had its turn.
  useEffect(() => {
    const onLift = (event: PointerEvent) => {
      if (!pointers.current.delete(event.pointerId) || pointers.current.size > 0) return;
      dispatch({
        type: event.type === 'pointercancel' ? 'abort' : 'release',
        at: eventTime(event.timeStamp),
      });
    };
    // A hidden page is sent no pointer events at all, so nothing still down
    // when it went away will ever be reported up.
    const onHide = () => {
      if (document.visibilityState === 'hidden') pointers.current.clear();
    };

    window.addEventListener('pointerup', onLift);
    window.addEventListener('pointercancel', onLift);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pointerup', onLift);
      window.removeEventListener('pointercancel', onLift);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [dispatch]);

  return {
    state,
    displayMs: displayedMs(state, frameAt),
    inspectionMs: inspectionElapsedMs(state, frameAt),
    armed: isArmed(state, frameAt, config),
    finishArmed: isFinishArmed(state, frameAt, config),
    phaseIndex: currentPhaseIndex(state, config),
    inspectionEnabled: config.inspectionEnabled,
    inspectionCues: settings?.inspectionCues ?? SETTING_DEFAULTS['timer.inspectionCues'],
    isLocked,
    setInspectionEnabled,
    reset,
    touchHandlers: {
      onPointerDown: (event: ReactPointerEvent) => {
        // A locked clock takes no part in the gesture at all. Swallowing the
        // default here is what stops a finger that lands on the digits from
        // scrolling the page, and with nothing to start there is nothing to
        // stop it for.
        if (isLocked) return;
        event.preventDefault();
        primeBeep();
        const isFirst = pointers.current.size === 0;
        pointers.current.add(event.pointerId);
        if (isFirst) dispatch({ type: 'press', at: eventTime(event.timeStamp) });
      },
      onPointerUp: (event: ReactPointerEvent) => {
        if (isLocked) return;
        event.preventDefault();
        // The release that stops the clock hands the screen back in the same
        // commit, so the press surface is gone before the tap's click is
        // dispatched — and a touch's click is hit-tested where it lands, not
        // where it started.
        if (event.pointerType !== 'mouse') swallowTapClick();
        if (!pointers.current.delete(event.pointerId) || pointers.current.size > 0) return;
        dispatch({ type: 'release', at: eventTime(event.timeStamp) });
      },
      onPointerCancel: (event: ReactPointerEvent) => {
        // Not refused while locked: the finger may have gone down before the
        // lock, and a press left open is what this exists to close.
        if (!pointers.current.delete(event.pointerId) || pointers.current.size > 0) return;
        dispatch({ type: 'abort', at: eventTime(event.timeStamp) });
      },
    },
  };
}

/**
 * Eats the click a tap leaves behind.
 *
 * Preventing the default on pointerdown suppresses the compatibility mouse
 * events but not the click, which arrives after the release and finds
 * whatever the timer was covering: the inspection toggle, the last solve's
 * DNF. Nothing on the press surface itself wants a click, so eating it costs
 * nothing.
 */
function swallowTapClick(): void {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  // The ghost comes with the tap or not at all; a click later than that is
  // one the user aimed.
  window.setTimeout(() => window.removeEventListener('click', swallow, true), 300);
}

/**
 * States where a release matters whatever key produced it: the press that
 * stopped the solve, and the press that is deciding between ending a phase
 * and finishing the solve.
 */
function awaitingRelease(state: TimerState): boolean {
  if (state.status === 'stopped') return true;
  return state.status === 'running' && state.pressedAt !== null;
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
