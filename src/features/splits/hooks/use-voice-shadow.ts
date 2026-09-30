import { useEffect, useRef, useState } from 'react';
import { DETECTOR_VERSION } from '../../../domain/audio/onset';
import { matchShadow, type ShadowMatch, type ShadowRecord } from '../../../domain/audio/shadow';
import type { TimerState } from '../../../domain/timer/timer-machine';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { logQuietly } from '../../../lib/errors';
import { useMic, type MicStatus } from './use-mic';

/**
 * How long after the clock stops a voice can still arrive: one is only
 * decided on once it has held for a while, and "hop" said with the last tap
 * is decided on after the stop.
 */
const SETTLE_MS = 500;
/** A few evenings of trying. The tally is what matters, not the history. */
const LOG_LIMIT = 300;

export interface VoiceShadow {
  mic: MicStatus;
  /** What the voice would have measured on the solve just finished. */
  result: ShadowMatch | null;
}

interface Run {
  startedAt: number;
  voiceMs: number[];
}

/**
 * The voice trial on the timer: the microphone listens while phases are
 * tapped, and each finished solve is compared with what it heard. Nothing
 * here touches the solve itself — the taps are what is saved.
 *
 * Voices are collected into a ref, not state: the clock redraws every frame
 * of a solve, and nothing may add a render of its own to that.
 */
export function useVoiceShadow(state: TimerState, isEnabled: boolean): VoiceShadow {
  const run = useRef<Run | null>(null);
  const settling = useRef<number | null>(null);
  const [result, setResult] = useState<ShadowMatch | null>(null);

  const { status, resume } = useMic(isEnabled, {
    onVoice: (atMs) => {
      const current = run.current;
      if (current && atMs >= current.startedAt) {
        current.voiceMs.push(Math.round(atMs - current.startedAt));
      }
    },
  });

  useEffect(() => {
    if (!isEnabled) return;
    switch (state.status) {
      case 'holding':
      case 'inspecting':
        // The press that got here was a gesture — the moment a browser lets
        // a context it started suspended run.
        resume();
        return;
      case 'running':
        if (run.current?.startedAt !== state.startedAt) {
          run.current = { startedAt: state.startedAt, voiceMs: [] };
          setResult(null);
        }
        return;
      case 'stopped': {
        const finished = run.current;
        if (finished === null || settling.current !== null) return;
        const { rawMs, splitMs } = state;
        settling.current = window.setTimeout(() => {
          settling.current = null;
          run.current = null;
          const record: ShadowRecord = {
            detector: DETECTOR_VERSION,
            splitMs: [...splitMs],
            rawMs,
            voiceMs: [...finished.voiceMs],
          };
          setResult(matchShadow(record));
          void appendRecord(record);
        }, SETTLE_MS);
        return;
      }
      case 'idle':
        // Idle without having stopped is an attempt abandoned: nothing to compare.
        if (settling.current === null) run.current = null;
        return;
    }
  }, [state, isEnabled, resume]);

  useEffect(
    () => () => {
      if (settling.current !== null) window.clearTimeout(settling.current);
    },
    [],
  );

  return { mic: status, result: isEnabled ? result : null };
}

async function appendRecord(record: ShadowRecord): Promise<void> {
  try {
    const log = await getSetting('audio.voiceShadowLog');
    await setSetting('audio.voiceShadowLog', [...log, record].slice(-LOG_LIMIT));
  } catch (cause) {
    // A trial solve that goes unlogged costs one line of a tally.
    logQuietly('Voice trial', cause);
  }
}
