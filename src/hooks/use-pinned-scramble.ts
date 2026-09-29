import { useSyncExternalStore } from 'react';
import type { ScrambleSource } from '../db/types';
import type { SharedScramble } from '../domain/scramble/share-link';

/** Where a scramble the timer did not generate came from — said on screen and kept with the solve. */
export type PinSource = Exclude<ScrambleSource, 'generated'>;

export type PinnedScramble =
  | { scramble: string; source: Exclude<PinSource, 'shared'> }
  /** A shared one brings the time it was done in, for this attempt to beat. */
  | { scramble: string; source: 'shared'; targetMs: number | null };

let pinned: PinnedScramble | null = null;
const listeners = new Set<() => void>();

function publish(next: PinnedScramble | null): void {
  pinned = next;
  for (const listener of listeners) listener();
}

/**
 * Puts a scramble on the timer in place of the generated one, for one solve:
 * one typed in from a competition or a friend, one taken from the history to
 * be solved again, or one opened from a link somebody shared. The generated scramble is not thrown away — it waits,
 * unseen, and comes back once this one has been solved.
 *
 * Held in memory rather than in the database. It lives for one attempt, and
 * a reload in between is the reader moving on; it also has to cross from the
 * history screen to the timer, which is why it is not the timer's own state.
 */
export function pinScramble(scramble: string, source: Exclude<PinSource, 'shared'>): void {
  publish({ scramble, source });
}

export function pinSharedScramble(shared: SharedScramble): void {
  publish({ scramble: shared.scramble, source: 'shared', targetMs: shared.targetMs });
}

export function unpinScramble(): void {
  if (pinned !== null) publish(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePinnedScramble(): PinnedScramble | null {
  return useSyncExternalStore(subscribe, () => pinned);
}
