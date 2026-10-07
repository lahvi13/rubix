import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { closesMenu, opensMenu } from '../lib/swipe';

export interface MenuSwipeHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

/**
 * Places whose drags belong to something else. The clock arms on a held
 * finger, and a swipe that started a solve would be the worst thing this
 * gesture could do; a sheet pages through its sequence sideways; a field
 * places its caret; the twisty player turns the cube.
 */
const OWN_DRAGS = [
  'input',
  'textarea',
  'select',
  '[data-no-swipe]',
  '[role="dialog"]',
  '.sheet-scrim',
  '.timer:not(.is-locked)',
  '.timer-overlay',
].join(', ');

/**
 * A drag to the right brings the menu in, one to the left puts it away. The
 * button stays the way to it; this is the way for a thumb that cannot reach the
 * top corner of a large phone.
 *
 * It answers only a drag that ends in a real pointerup — never one the browser
 * took for a scroll — which is also what lets the menu's back entry count: a
 * scroll grants no user activation, and an entry pushed without it is one
 * Chrome skips on the way back (see `usePull`).
 */
export function useMenuSwipe(
  isOpen: boolean,
  setOpen: (isOpen: boolean) => void,
): MenuSwipeHandlers {
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  return {
    onPointerDown: (event) => {
      const target = event.target;
      const isElsewhere =
        !event.isPrimary ||
        (!isOpen && target instanceof Element && target.closest(OWN_DRAGS) !== null);
      start.current = isElsewhere
        ? null
        : { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    },
    onPointerUp: (event) => {
      const from = start.current;
      start.current = null;
      if (from === null || from.pointerId !== event.pointerId) return;

      const to = { x: event.clientX, y: event.clientY };
      const bounds = { width: window.innerWidth };
      if (isOpen ? closesMenu(from, to, bounds) : opensMenu(from, to, bounds)) {
        setOpen(!isOpen);
      }
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
