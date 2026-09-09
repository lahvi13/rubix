/**
 * The back gesture closes the panel on top rather than leaving the screen.
 *
 * A panel is not a place in the app, so it gets a history entry carrying the
 * same URL rather than a route of its own: nothing about the hash changes, and
 * the router never hears about it.
 *
 * One entry per open panel, and every one of them pushed at the moment the
 * panel opens. Nothing is ever pushed from inside the pop handler: Chrome on
 * Android decides whether the next press leaves the app before the page's
 * script runs, so an entry created there can arrive too late to be counted —
 * which is a back press spent leaving with a panel still open.
 */

interface Panel {
  /** Identifies this panel's own entry, so nobody pops somebody else's. */
  id: number;
  close: () => void;
  /** False once a back press has spent the entry this panel was holding. */
  isHolding: boolean;
}

const panels: Panel[] = [];
let nextId = 1;

/** The id on the entry at the top of the stack, if it is one of ours. */
function currentId(): number | null {
  const state: unknown = window.history.state;
  if (typeof state !== 'object' || state === null || !('rubixPanel' in state)) return null;
  const id: unknown = (state as { rubixPanel: unknown }).rubixPanel;
  return typeof id === 'number' ? id : null;
}

function handlePop(): void {
  // The entry the browser has just left belonged to the panel on top.
  const panel = panels[panels.length - 1];
  if (panel === undefined) return;
  panel.isHolding = false;
  panel.close();
}

/**
 * Registers a panel as open and returns the release for when it closes. Not
 * only sheets: the timer's list of solves is dragged up over the screen and
 * closes on the same press, for the same reason.
 */
export function holdBackForPanel(close: () => void): () => void {
  // A panel that hands over to another — the solve detail becoming the session
  // picker — unmounts and mounts inside one commit, and the entry of the one
  // going is still on top. The newcomer takes it over rather than stacking a
  // second, or closing one panel would take two presses.
  const inherited = panels.length === 0 ? currentId() : null;
  const panel: Panel = { id: inherited ?? nextId++, close, isHolding: true };
  panels.push(panel);
  if (inherited === null) window.history.pushState({ rubixPanel: panel.id }, '');
  if (panels.length === 1) window.addEventListener('popstate', handlePop);

  return () => {
    const at = panels.indexOf(panel);
    if (at >= 0) panels.splice(at, 1);
    if (panels.length === 0) window.removeEventListener('popstate', handlePop);
    // A back press already spent the entry; there is nothing to take back.
    if (!panel.isHolding) return;

    // Closed some other way, so the entry has to go — but only if it is still
    // on top and nobody has taken it over. Deferred by a microtask, which is
    // when a hand-over has had its chance to claim it.
    queueMicrotask(() => {
      if (panels.length === 0 && currentId() === panel.id) window.history.back();
    });
  };
}

/** Test seam: forgets everything this module is holding. */
export function resetSheetHistory(): void {
  panels.length = 0;
  window.removeEventListener('popstate', handlePop);
}
