/**
 * The microphone's samples go this far and no further: the detector runs here,
 * on the audio thread, and what crosses back to the page is where each sound
 * began, what it was judged on, and how loud the room is — numbers, never
 * the sound itself.
 */

import { createOnsetDetector } from '../domain/audio/onset';
import { ONSET_PROCESSOR, type OnsetProcessorMessage } from './onset-messages';

// The AudioWorkletGlobalScope, which the DOM typings do not describe.
declare const sampleRate: number;
declare const currentFrame: number;
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessor & {
    process(inputs: Float32Array[][]): boolean;
  },
): void;

/** About 40 ms at 48 kHz: often enough to draw a meter, rare enough to cost nothing. */
const HEARTBEAT_BLOCKS = 16;

class OnsetProcessor extends AudioWorkletProcessor {
  private readonly detector = createOnsetDetector(sampleRate);
  private pushed = 0;
  private blocks = 0;

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    this.pushed += channel.length;
    const endFrame = currentFrame + channel.length;

    // Counted back from the end of this block, not forward from the first:
    // a block the engine dropped would otherwise shift every onset after it.
    for (const { at, ...traits } of this.detector.push(channel)) {
      this.post({ type: 'sound', frame: endFrame - (this.pushed - at), ...traits });
    }
    if (++this.blocks % HEARTBEAT_BLOCKS === 0) {
      this.post({
        type: 'level',
        frame: endFrame,
        levelDb: this.detector.levelDb,
        gateDb: this.detector.gateDb,
      });
    }
    return true;
  }

  private post(message: OnsetProcessorMessage): void {
    this.port.postMessage(message);
  }
}

registerProcessor(ONSET_PROCESSOR, OnsetProcessor);
