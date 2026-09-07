/**
 * The way back from a delete.
 *
 * One offer at a time, held here rather than in a screen: the solve that was
 * deleted on the timer is undone from wherever the user happens to be a second
 * later, and a bar that unmounts with its screen would be a promise the app
 * does not keep. Nothing in here knows what is being undone — the caller hands
 * over the work to run if the offer is taken.
 */

export interface UndoOffer {
  /** What just happened, in the user's words. */
  message: string;
  /** Puts it back. Run at most once, and only if the user asks. */
  undo: () => void;
}

type Listener = (offer: UndoOffer | null) => void;

const listeners = new Set<Listener>();
let pending: UndoOffer | null = null;

/**
 * A newer offer replaces an older one instead of queueing. Two undo bars would
 * have to be told apart in a hurry, and the one that is still on screen is
 * always the one that just happened.
 */
export function offerUndo(message: string, undo: () => void): void {
  publish({ message, undo });
}

export function takeUndo(): void {
  const offer = pending;
  publish(null);
  offer?.undo();
}

export function clearUndo(): void {
  publish(null);
}

export function pendingUndo(): UndoOffer | null {
  return pending;
}

export function onUndoOffer(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(offer: UndoOffer | null): void {
  pending = offer;
  for (const listener of listeners) listener(offer);
}
