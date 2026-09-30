/**
 * What the onset processor and the page say to each other. Its own module so
 * the page can name the processor without importing it — the processor file
 * registers itself on load, which only works inside the audio worklet.
 */

export const ONSET_PROCESSOR = 'rubix-onset';

export type OnsetProcessorMessage =
  /** A voice began at this frame of the context's clock. */
  | { type: 'onset'; frame: number }
  /**
   * Sent every few blocks: the page reads the context's clock against its own
   * from these, and the level meter draws them.
   */
  | { type: 'level'; frame: number; levelDb: number; gateDb: number };

/** Checked on arrival: a message port carries whatever was put on it. */
export function readOnsetMessage(data: unknown): OnsetProcessorMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const message: Partial<Record<'type' | 'frame' | 'levelDb' | 'gateDb', unknown>> = data;
  if (typeof message.frame !== 'number') return null;
  if (message.type === 'onset') return { type: 'onset', frame: message.frame };
  if (
    message.type === 'level' &&
    typeof message.levelDb === 'number' &&
    typeof message.gateDb === 'number'
  ) {
    return { type: 'level', frame: message.frame, levelDb: message.levelDb, gateDb: message.gateDb };
  }
  return null;
}
