import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { isPullDown } from '../lib/swipe';

export interface PullHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

/**
 * Pulling a list back down, for a panel that was dragged open.
 *
 * Armed only while the list is at its top. Anywhere else a downward drag is a
 * scroll, and taking it for a gesture would close the panel out from under
 * somebody reading the middle of it. At the top there is nothing above to
 * scroll to, so the drag can only mean one thing.
 */
export function usePullDown(onPull: () => void): PullHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown: (event) => {
      const target = event.currentTarget;
      // Only from the top of the list, and never from a field being dragged in.
      if (
        target.scrollTop > 0 ||
        (event.target instanceof Element && event.target.closest('input, textarea'))
      ) {
        start.current = null;
        return;
      }
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event) => {
      const from = start.current;
      start.current = null;
      if (from !== null && isPullDown(from, { x: event.clientX, y: event.clientY })) onPull();
    },
    // The browser took the gesture to scroll with; it was never a pull.
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
