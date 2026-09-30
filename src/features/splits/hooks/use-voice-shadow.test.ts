import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DETECTOR_VERSION } from '../../../domain/audio/onset';
import type { TimerState } from '../../../domain/timer/timer-machine';
import { db } from '../../../db/schema';
import { getSetting } from '../../../db/repositories/settings-repository';
import type { MicHandlers } from '../../../lib/mic-listener';
import { useVoiceShadow } from './use-voice-shadow';

// The microphone is the one thing a test cannot have: it is stood in for by
// a listener the test speaks into itself.
let handlers: MicHandlers | null = null;
vi.mock('../../../lib/mic-listener', () => ({
  MicError: class extends Error {},
  openMic: (given: MicHandlers) => {
    handlers = given;
    return Promise.resolve({ resume: () => {}, close: () => {} });
  },
}));

const IDLE: TimerState = { status: 'idle', lastRawMs: null };

function running(startedAt: number, splitMs: number[] = []): TimerState {
  return { status: 'running', startedAt, inspectionMs: null, splitMs, pressedAt: null };
}

function stopped(rawMs: number, splitMs: number[]): TimerState {
  return { status: 'stopped', rawMs, inspectionMs: null, splitMs };
}

/** The hook waits a second after the stop for sounds still being judged. */
const SETTLED = { timeout: 3000 };

const TRAITS = {
  durationMs: 150,
  periodicity: 0.9,
  pitchHz: 150,
  steadiness: 1,
  loudnessDb: 30,
};

/** A sound heard at `atMs`; the detector took it for the word unless told otherwise. */
function hear(atMs: number, isVoice = true) {
  if (handlers === null) throw new Error('The microphone was never opened');
  handlers.onSound({ atMs, isVoice, ...TRAITS });
}

function kept(atMs: number, isVoice = true) {
  return { atMs, isVoice, ...TRAITS };
}

async function listening(initial: TimerState = IDLE) {
  const hook = renderHook(({ state }) => useVoiceShadow(state, true), {
    initialProps: { state: initial },
  });
  await waitFor(() => expect(hook.result.current.mic.kind).toBe('listening'));
  return hook;
}

describe('useVoiceShadow', () => {
  beforeEach(async () => {
    handlers = null;
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('compares what it heard with the taps once the solve has stopped', async () => {
    const { result, rerender } = await listening();
    rerender({ state: running(1000) });
    hear(900); // inspection's last words, before the clock started
    hear(3040);
    hear(5000, false); // a clatter the detector turned away
    rerender({ state: running(1000, [2000]) });
    hear(9950); // said with the stop
    rerender({ state: stopped(9000, [2000]) });
    rerender({ state: { status: 'idle', lastRawMs: 9000 } });

    await waitFor(
      () =>
        expect(result.current.result).toEqual({
          boundaries: 1,
          heard: 1,
          extra: 0,
          offsetsMs: [40],
        }),
      SETTLED,
    );
    await waitFor(async () =>
      expect(await getSetting('audio.voiceShadowLog')).toEqual([
        {
          detector: DETECTOR_VERSION,
          splitMs: [2000],
          rawMs: 9000,
          voiceMs: [2040, 8950],
          sounds: [kept(2040), kept(4000, false), kept(8950)],
        },
      ]),
    );
  });

  it('forgets an attempt abandoned before it stopped', async () => {
    const { result, rerender } = await listening();
    rerender({ state: running(1000) });
    hear(3040);
    rerender({ state: IDLE });
    rerender({ state: running(20_000) });
    rerender({ state: stopped(5000, []) });

    await waitFor(
      () =>
        expect(result.current.result).toEqual({ boundaries: 0, heard: 0, extra: 0, offsetsMs: [] }),
      SETTLED,
    );
    const log = await getSetting('audio.voiceShadowLog');
    expect(log).toEqual([
      { detector: DETECTOR_VERSION, splitMs: [], rawMs: 5000, voiceMs: [], sounds: [] },
    ]);
  });

  it('keeps the microphone shut while the trial is off', () => {
    const { result } = renderHook(() => useVoiceShadow(IDLE, false));
    expect(result.current.mic.kind).toBe('off');
    expect(handlers).toBeNull();
  });
});
