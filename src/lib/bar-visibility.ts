/** Where the page was and which way the bar was last sent, between two scrolls. */
export interface BarScroll {
  /** Where the current run in one direction began. */
  anchorY: number;
  lastY: number;
  isShown: boolean;
}

/**
 * Near the top the bar always shows: there is nothing above to make room for,
 * and a page opened at the top should look like every other page.
 */
const TOP_PX = 48;

/**
 * How far a run has to go in one direction before the bar follows it. A thumb
 * resting on a list drifts a few pixels either way; a bar that answered every
 * one of them would flicker.
 */
const RUN_PX = 32;

export const BAR_SHOWN: BarScroll = { anchorY: 0, lastY: 0, isShown: true };

/**
 * The bottom bar after the page has scrolled to `y`: away while the reader
 * moves down through the page, back the moment they head up again.
 */
export function scrollBar(state: BarScroll, y: number): BarScroll {
  if (y <= TOP_PX) return { anchorY: y, lastY: y, isShown: true };

  const wasDown = state.lastY >= state.anchorY;
  const isDown = y >= state.lastY;
  // A turn starts a new run from where the page turned.
  const anchorY = wasDown === isDown ? state.anchorY : state.lastY;
  const run = y - anchorY;

  let isShown = state.isShown;
  if (run >= RUN_PX) isShown = false;
  else if (run <= -RUN_PX) isShown = true;
  return { anchorY, lastY: y, isShown };
}
