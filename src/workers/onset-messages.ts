/**
 * What the onset processor and the page say to each other. Its own module so
 * the page can name the processor without importing it — the processor file
 * registers itself on load, which only works inside the audio worklet.
 */

import { isVerdict, type Sound, type VoiceProfile } from '../domain/audio/onset';

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

/** What the page hands the processor when it creates it. */
export interface OnsetProcessorOptions {
  voice: VoiceProfile | null;
}

/** Checked on arrival, like the messages: the options cross a thread boundary too. */
export function readProcessorOptions(value: unknown): OnsetProcessorOptions {
  if (typeof value !== 'object' || value === null) return { voice: null };
  const options: Partial<Record<keyof OnsetProcessorOptions, unknown>> = value;
  const voice = options.voice;
  if (typeof voice !== 'object' || voice === null) return { voice: null };
  const profile: Partial<Record<keyof VoiceProfile, unknown>> = voice;
  const { loudnessDb, pitchHz } = profile;
  return typeof loudnessDb === 'number' && typeof pitchHz === 'number' && pitchHz > 0
    ? { voice: { loudnessDb, pitchHz } }
    : { voice: null };
}

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
    const { verdict, durationMs, periodicity, pitchHz, steadiness, loudnessDb } = message;
    if (
      !isVerdict(verdict) ||
      typeof durationMs !== 'number' ||
      typeof periodicity !== 'number' ||
      typeof pitchHz !== 'number' ||
      typeof steadiness !== 'number' ||
      typeof loudnessDb !== 'number'
    ) {
      return null;
    }
    return { type: 'sound', frame, verdict, durationMs, periodicity, pitchHz, steadiness, loudnessDb };
  }
  return null;
}
