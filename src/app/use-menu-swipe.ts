import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { closesMenu, isMenuDrag, opensMenu } from '../lib/swipe';

export interface MenuSwipeHandlers {
  ref: (element: HTMLElement | null) => (() => void) | undefined;
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
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
  const open = useRef(isOpen);
  useEffect(() => {
    open.current = isOpen;
  });

  /*
   * Once a drag is heading for the menu, its touchmoves are cancelled. Left to
   * the browser, Chrome on Android finishes a quick swipe as a fling even with
   * nothing to scroll, and the first tap after it — on the menu item the
   * swipe was for — only stops the fling: measured, three swipes in four lost
   * that tap. Cancelling the touchend instead did not help. Only the drags
   * that are the menu's are held; a scroll goes on being the browser's.
   */
  const isSwiping = useRef(false);
  const ref = useCallback((element: HTMLElement | null) => {
    if (element === null) return undefined;
    const hold = (event: TouchEvent) => {
      if (isSwiping.current && event.cancelable) event.preventDefault();
    };
    element.addEventListener('touchmove', hold, { passive: false });
    return () => element.removeEventListener('touchmove', hold);
  }, []);

  return {
    ref,
    onPointerDown: (event) => {
      const target = event.target;
      const isElsewhere =
        !event.isPrimary ||
        (!isOpen && target instanceof Element && target.closest(OWN_DRAGS) !== null);
      isSwiping.current = false;
      start.current = isElsewhere
        ? null
        : { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    },
    onPointerMove: (event) => {
      const from = start.current;
      if (from === null || isSwiping.current || from.pointerId !== event.pointerId) return;
      const to = { x: event.clientX, y: event.clientY };
      isSwiping.current = isMenuDrag(from, to, { width: window.innerWidth }, open.current);
    },
    onPointerUp: (event) => {
      const from = start.current;
      start.current = null;
      isSwiping.current = false;
      if (from === null || from.pointerId !== event.pointerId) return;

      const to = { x: event.clientX, y: event.clientY };
      const bounds = { width: window.innerWidth };
      if (isOpen ? closesMenu(from, to, bounds) : opensMenu(from, to, bounds)) {
        setOpen(!isOpen);
      }
    },
    onPointerCancel: () => {
      start.current = null;
      isSwiping.current = false;
    },
  };
}
