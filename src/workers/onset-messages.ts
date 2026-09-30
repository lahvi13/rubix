/**
 * What the onset processor and the page say to each other. Its own module so
 * the page can name the processor without importing it — the processor file
 * registers itself on load, which only works inside the audio worklet.
 */

import type { Sound } from '../domain/audio/onset';

export const ONSET_PROCESSOR = 'rubix-onset';

export type SoundTraits = Omit<Sound, 'at'>;

export type OnsetProcessorMessage =
  /** A sound was judged; it began at this frame of the context's clock. */
  | ({ type: 'sound'; frame: number } & SoundTraits)
  /**
   * Sent every few blocks: the page reads the context's clock against its own
   * from these, and the level meter draws them.
   */
  | { type: 'level'; frame: number; levelDb: number; gateDb: number };

type Fields = 'type' | 'frame' | 'levelDb' | 'gateDb' | keyof SoundTraits;

/** Checked on arrival: a message port carries whatever was put on it. */
export function readOnsetMessage(data: unknown): OnsetProcessorMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const message: Partial<Record<Fields, unknown>> = data;
  const { frame } = message;
  if (typeof frame !== 'number') return null;
  if (message.type === 'level') {
    const { levelDb, gateDb } = message;
    if (typeof levelDb !== 'number' || typeof gateDb !== 'number') return null;
    return { type: 'level', frame, levelDb, gateDb };
  }
  if (message.type === 'sound') {
    const { isVoice, durationMs, periodicity, pitchHz, steadiness, loudnessDb } = message;
    if (
      typeof isVoice !== 'boolean' ||
      typeof durationMs !== 'number' ||
      typeof periodicity !== 'number' ||
      typeof pitchHz !== 'number' ||
      typeof steadiness !== 'number' ||
      typeof loudnessDb !== 'number'
    ) {
      return null;
    }
    return { type: 'sound', frame, isVoice, durationMs, periodicity, pitchHz, steadiness, loudnessDb };
  }
  return null;
}
