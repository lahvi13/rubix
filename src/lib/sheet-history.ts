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
/**
 * Counted from the moment the page loaded rather than from one. A reload keeps
 * the entries it had, and an id counted from one again would be taken for the
 * entry of a panel that closed before the reload.
 */
let nextId = Math.floor(performance.timeOrigin);
/**
 * The entry a panel has just let go of, for the length of one commit. A panel
 * opening in that window is taking over from the one that closed; anything
 * later is a different situation and must push an entry of its own.
 */
let handedOver: number | null = null;
/** Steps back the page takes itself, which the pop handler must not read as a press. */
let ownPops = 0;
let isListening = false;

/** The id on the entry at the top of the stack, if it is one of ours. */
function currentId(): number | null {
  const state: unknown = window.history.state;
  if (typeof state !== 'object' || state === null || !('rubixPanel' in state)) return null;
  const id: unknown = (state as { rubixPanel: unknown }).rubixPanel;
  return typeof id === 'number' ? id : null;
}

/** One of our entries whose panel is gone. */
function isStale(id: number | null): boolean {
  return id !== null && !panels.some((panel) => panel.id === id);
}

function stepBack(): void {
  ownPops++;
  window.history.back();
}

function handlePop(): void {
  if (ownPops > 0) {
    ownPops--;
  } else {
    // The entry the browser has just left belonged to the panel on top.
    const panel = panels[panels.length - 1];
    if (panel !== undefined) {
      panel.isHolding = false;
      panel.close();
    }
  }

  // Arrived at an entry whose panel closed while another was open above it —
  // too deep to have been taken away then. Nothing is open here, so a press
  // that stopped on it would change nothing the reader can see.
  if (isStale(currentId())) stepBack();
}

/**
 * Registers a panel as open and returns the release for when it closes. Not
 * only sheets: the timer's list of solves is dragged up over the screen and
 * closes on the same press, for the same reason, and picking solves in the
 * history is left the same way.
 */
export function holdBackForPanel(close: () => void): () => void {
  // A panel that hands over to another — the solve detail becoming the session
  // picker — unmounts and mounts inside one commit, and the entry of the one
  // going is still on top. The newcomer takes it over rather than stacking a
  // second, or closing one panel would take two presses.
  //
  // Only an entry handed over just now, though. A reload keeps the state on
  // the entry it reloads, so after one there can be an id sitting there that
  // no panel is holding — and taking that over would mean opening a panel
  // without an entry at all, leaving the app on the first back press.
  const inherited = handedOver !== null && currentId() === handedOver ? handedOver : null;
  const panel: Panel = { id: inherited ?? nextId++, close, isHolding: true };
  panels.push(panel);
  if (inherited === null) window.history.pushState({ rubixPanel: panel.id }, '');
  // Listening for as long as the page lives, not only while something is
  // open: a stale entry can outlast every panel, and it still has to be
  // stepped over when a press arrives at it.
  if (!isListening) {
    window.addEventListener('popstate', handlePop);
    isListening = true;
  }

  return () => {
    const at = panels.indexOf(panel);
    if (at >= 0) panels.splice(at, 1);
    // A back press already spent the entry; there is nothing to take back.
    if (!panel.isHolding) return;

    // Closed some other way, so the entry has to go — including when another
    // panel stays open beneath it, like the session picker dismissed in the
    // middle of picking solves. Offered for the length of one commit first,
    // which is when a hand-over has its chance to claim it, and taken only if
    // it is still on top; one that is not is stepped over when back gets there.
    handedOver = panel.id;
    queueMicrotask(() => {
      if (handedOver === panel.id) handedOver = null;
      if (currentId() === panel.id && isStale(panel.id)) stepBack();
    });
  };
}

/** Test seam: forgets everything this module is holding. */
export function resetSheetHistory(): void {
  panels.length = 0;
  handedOver = null;
  ownPops = 0;
  window.removeEventListener('popstate', handlePop);
  isListening = false;
}
