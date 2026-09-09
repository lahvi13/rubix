import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { readSwipe, type SwipeDirection } from '../lib/swipe';

export interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

/**
 * Turns a drag across the panel into a step through whatever it is one of.
 *
 * Two things get to keep their own drags and are skipped by name: a text field,
 * where dragging places the caret, and anything marked `data-no-swipe` — the
 * twisty player is turned by dragging it, and a swipe that spun the cube
 * instead of turning the page would be maddening.
 */
export function useSwipe(onSwipe: (direction: SwipeDirection) => void): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown: (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, [data-no-swipe]')) {
        start.current = null;
        return;
      }
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event) => {
      const from = start.current;
      start.current = null;
      if (from === null) return;

      const direction = readSwipe(from, { x: event.clientX, y: event.clientY }, {
        width: window.innerWidth,
      });
      if (direction !== null) onSwipe(direction);
    },
    // The browser takes the pointer away the moment it starts scrolling with
    // it; what it took was never a swipe.
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
