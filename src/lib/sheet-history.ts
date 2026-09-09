/**
 * The back gesture closes the panel on top instead of leaving the screen.
 *
 * A panel is not a place in the app, so it gets a history entry with the same
 * URL rather than a route of its own: nothing about the hash changes, and the
 * router never hears about it.
 *
 * One entry stands for "a panel is open", not one entry per panel. A panel that
 * hands over to another — the solve detail turning into the session picker —
 * unmounts one and mounts the next within a single commit, and an entry pushed
 * and released on both sides of that would race: the release landing after the
 * push takes away the entry the new panel is relying on.
 */

const closers: Array<() => void> = [];
let hasEntry = false;

function handlePop(): void {
  // The entry is already gone by the time this runs — the browser popped it.
  hasEntry = false;
  // Counted before closing, because the panel being closed leaves the list
  // asynchronously and would still be in it if counted after.
  const remaining = closers.length - 1;
  closers[closers.length - 1]?.();

  // Something under it is still open — a sheet over the timer's list, say.
  // The entry they were sharing went with this press, so what is left needs
  // another, or the next press would leave the screen with a panel still up.
  if (remaining > 0) {
    window.history.pushState({ rubixPanel: true }, '');
    hasEntry = true;
  }
}

/** True while the entry on top of the stack is one this module pushed. */
function ownsCurrentEntry(): boolean {
  const state: unknown = window.history.state;
  return typeof state === 'object' && state !== null && 'rubixPanel' in state;
}

/**
 * Registers a panel as open and returns the release for when it closes. Not
 * only sheets: the timer's list of solves is dragged up over the screen and
 * closes on the same press, for the same reason.
 * `close` is called when the back gesture is what closed it.
 */
export function holdBackForPanel(close: () => void): () => void {
  closers.push(close);
  if (!hasEntry) {
    window.history.pushState({ rubixPanel: true }, '');
    hasEntry = true;
    window.addEventListener('popstate', handlePop);
  }

  return () => {
    const at = closers.lastIndexOf(close);
    if (at >= 0) closers.splice(at, 1);
    if (closers.length > 0) return;

    // Deferred by a microtask so a hand-over from one panel to the next, which
    // empties and refills this list inside one commit, keeps the same entry.
    queueMicrotask(() => {
      if (closers.length > 0 || !hasEntry) return;
      hasEntry = false;
      window.removeEventListener('popstate', handlePop);
      // Only ever our own: if a route was navigated to while the panel was
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
