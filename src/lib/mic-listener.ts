/**
 * The microphone, opened for the onset processor and nothing else. The stream
 * goes straight into the audio worklet; the page gets back only when a voice
 * began and how loud the room is. Nothing is recorded, kept or sent.
 */

import processorUrl from '../workers/onset-processor.ts?worker&url';
import { ONSET_PROCESSOR, readOnsetMessage } from '../workers/onset-messages';
import { eventTime } from './clock';

export type MicFailure = 'denied' | 'unavailable';

export class MicError extends Error {
  readonly reason: MicFailure;

  constructor(reason: MicFailure, cause?: unknown) {
    super(`Microphone ${reason}`, { cause });
    this.reason = reason;
  }
}

export interface MicLevel {
  levelDb: number;
  /** What a voice has to reach right now to be heard. */
  gateDb: number;
}

export interface MicHandlers {
  /** A voice began, on the monotonic clock the timer measures with. */
  onVoice(atMs: number): void;
  onLevel?(level: MicLevel): void;
}

export interface MicListener {
  /** Wakes a context the browser started suspended; call it from a gesture. */
  resume(): void;
  close(): void;
}

/** Heartbeats the clock is read from: a couple of seconds' worth. */
const CLOCK_READINGS = 64;

export async function openMic(handlers: MicHandlers): Promise<MicListener> {
  if (
    typeof navigator.mediaDevices?.getUserMedia !== 'function' ||
    typeof AudioWorkletNode === 'undefined'
  ) {
    throw new MicError('unavailable');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // All three reshape the signal before the detector sees it: noise
        // suppression takes the edge off an onset and adds delay, and gain
        // control keeps moving the level the gate is measured against.
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
  } catch (cause) {
    const isRefused =
      cause instanceof DOMException &&
      (cause.name === 'NotAllowedError' || cause.name === 'SecurityError');
    throw new MicError(isRefused ? 'denied' : 'unavailable', cause);
  }

  const context = new AudioContext({ latencyHint: 'interactive' });
  let node: AudioWorkletNode;
  let source: MediaStreamAudioSourceNode;
  try {
    await context.audioWorklet.addModule(processorUrl);
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, ONSET_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    source.connect(node);
    // Some engines only run a node something downstream pulls on. The
    // processor writes nothing to its output, so what reaches the speaker is
    // silence — the microphone is never played back.
    node.connect(context.destination);
  } catch (cause) {
    for (const track of stream.getTracks()) track.stop();
    void context.close();
    throw new MicError('unavailable', cause);
  }

  /*
   * The worklet counts time in frames of the audio clock, the timer in
   * performance.now(). Every heartbeat says "frame F was just processed" and
   * arrives a little late; the least late of the recent ones is the best
   * reading of where one clock stands against the other.
   */
  const readings: number[] = [];
  let clockOffsetMs: number | null = null;

  node.port.onmessage = (event: MessageEvent<unknown>) => {
    const message = readOnsetMessage(event.data);
    if (message === null) return;
    const contextMs = (message.frame / context.sampleRate) * 1000;
    if (message.type === 'level') {
      readings.push(eventTime(event.timeStamp) - contextMs);
      if (readings.length > CLOCK_READINGS) readings.shift();
      clockOffsetMs = Math.min(...readings);
      handlers.onLevel?.({ levelDb: message.levelDb, gateDb: message.gateDb });
      return;
    }
    // A voice before the first heartbeat is dated by its own message instead.
    handlers.onVoice(contextMs + (clockOffsetMs ?? eventTime(event.timeStamp) - contextMs));
  };

  const resume = () => {
    if (context.state === 'suspended') void context.resume().catch(() => {});
  };
  resume();

  return {
    resume,
    close: () => {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      for (const track of stream.getTracks()) track.stop();
      void context.close().catch(() => {});
    },
  };
}
