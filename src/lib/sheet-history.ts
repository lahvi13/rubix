/**
 * The back gesture closes the panel on top instead of leaving the screen.
 *
 * A sheet is not a place in the app, so it gets a history entry with the same
 * URL rather than a route of its own: nothing about the hash changes, and the
 * router never hears about it.
 *
 * One entry stands for "a sheet is open", not one entry per sheet. A sheet that
 * hands over to another — the solve detail turning into the session picker —
 * unmounts one and mounts the next within a single commit, and an entry pushed
 * and released on both sides of that would race: the release landing after the
 * push takes away the entry the new sheet is relying on.
 */

const closers: Array<() => void> = [];
let hasEntry = false;

function handlePop(): void {
  // The entry is already gone by the time this runs — the browser popped it.
  hasEntry = false;
  closers[closers.length - 1]?.();
}

/** True while the entry on top of the stack is one this module pushed. */
function ownsCurrentEntry(): boolean {
  const state: unknown = window.history.state;
  return typeof state === 'object' && state !== null && 'rubixSheet' in state;
}

/**
 * Registers a sheet as open and returns the release for when it closes.
 * `close` is called when the back gesture is what closed it.
 */
export function holdBackForSheet(close: () => void): () => void {
  closers.push(close);
  if (!hasEntry) {
    window.history.pushState({ rubixSheet: true }, '');
    hasEntry = true;
    window.addEventListener('popstate', handlePop);
  }

  return () => {
    const at = closers.lastIndexOf(close);
    if (at >= 0) closers.splice(at, 1);
    if (closers.length > 0) return;

    // Deferred by a microtask so a hand-over from one sheet to the next, which
    // empties and refills this list inside one commit, keeps the same entry.
    queueMicrotask(() => {
      if (closers.length > 0 || !hasEntry) return;
      hasEntry = false;
      window.removeEventListener('popstate', handlePop);
      // Only ever our own: if a route was navigated to while the sheet was
      // open, the entry on top belongs to that and going back would undo it.
      if (ownsCurrentEntry()) window.history.back();
    });
  };
}

/** Test seam: forgets everything this module is holding. */
export function resetSheetHistory(): void {
  closers.length = 0;
  hasEntry = false;
  window.removeEventListener('popstate', handlePop);
}
