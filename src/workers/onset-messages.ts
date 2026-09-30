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

/** What the page tells the running processor: the voice to judge against from now on. */
export interface OnsetVoiceMessage {
  type: 'voice';
  voice: VoiceProfile | null;
}

/** Checked on arrival, like the messages: the options cross a thread boundary too. */
export function readProcessorOptions(value: unknown): OnsetProcessorOptions {
  if (typeof value !== 'object' || value === null) return { voice: null };
  const options: Partial<Record<keyof OnsetProcessorOptions, unknown>> = value;
  return { voice: readVoice(options.voice) };
}

/** A new voice from the page, or null for anything else that arrives. */
export function readVoiceMessage(data: unknown): OnsetVoiceMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const message: Partial<Record<keyof OnsetVoiceMessage, unknown>> = data;
  return message.type === 'voice' ? { type: 'voice', voice: readVoice(message.voice) } : null;
}

function readVoice(value: unknown): VoiceProfile | null {
  if (typeof value !== 'object' || value === null) return null;
  const profile: Partial<Record<keyof VoiceProfile, unknown>> = value;
  const { loudnessDb } = profile;
  return typeof loudnessDb === 'number' && loudnessDb > 0 ? { loudnessDb } : null;
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
