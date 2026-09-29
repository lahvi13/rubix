import { useSyncExternalStore } from 'react';
import type { ScrambleSource } from '../db/types';
import type { SharedScrambles } from '../domain/scramble/share-link';

/** Where a scramble the timer did not generate came from — said on screen and kept with the solve. */
export type PinSource = Exclude<ScrambleSource, 'generated'>;

/**
 * Scrambles somebody shared, being worked through in order, with the time
 * they were done in: one to beat a single, five or twelve to beat an average.
 */
export interface SharedRun {
  scrambles: readonly string[];
  targetMs: number | null;
  /** The final times of the ones already solved, in order; null is a DNF. */
  resultsMs: readonly (number | null)[];
}

export type PinnedScramble =
  | { scramble: string; source: Exclude<PinSource, 'shared'> }
  | { scramble: string; source: 'shared'; run: SharedRun };

let pinned: PinnedScramble | null = null;
const listeners = new Set<() => void>();

function publish(next: PinnedScramble | null): void {
  pinned = next;
  for (const listener of listeners) listener();
}

/**
 * Puts a scramble on the timer in place of the generated one, for one solve:
 * one typed in from a competition or a friend, or one taken from the history
 * to be solved again. The generated scramble is not thrown away — it waits,
 * unseen, and comes back once this one has been solved.
 *
 * Held in memory rather than in the database. It lives for one attempt, and
 * a reload in between is the reader moving on; it also has to cross from the
 * history screen to the timer, which is why it is not the timer's own state.
 */
export function pinScramble(scramble: string, source: Exclude<PinSource, 'shared'>): void {
  publish({ scramble, source });
}

/** Scrambles from a link, from the first; `advancePin` moves through them. */
export function pinSharedScrambles(shared: SharedScrambles): void {
  runFrom({ scrambles: shared.scrambles, targetMs: shared.targetMs, resultsMs: [] });
}

function runFrom(run: SharedRun): void {
  const scramble = run.scrambles[run.resultsMs.length];
  publish(scramble === undefined ? null : { scramble, source: 'shared', run });
}

/**
 * The pinned scramble has been solved, to `resultMs` (null for a DNF). A
 * shared run goes on to its next scramble; anything else, or the last of a
 * run, gives the timer back to the generated scrambles.
 */
export function advancePin(resultMs: number | null): void {
  if (pinned?.source === 'shared') {
    runFrom({ ...pinned.run, resultsMs: [...pinned.run.resultsMs, resultMs] });
  } else {
    unpinScramble();
  }
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
