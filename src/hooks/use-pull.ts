import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { isPullDown, isPullUp } from '../lib/swipe';

export interface PullHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
}

/**
 * Dragging a panel open, or back shut.
 *
 * The surface this goes on must be one the browser will not claim: it takes a
 * drag on anything scrollable for a scroll after a dozen pixels, long before
 * one could be told from the other. That is not only about the gesture. A
 * touch consumed by scrolling grants no user activation — at no point of it,
 * the finger lifting included — and Chrome marks a history entry pushed
 * without activation as one to skip. The back press that should have put the
 * panel away then sails past it and out of the app. So a panel that holds a
 * back entry has to be opened by a gesture that ends in a real pointerup,
 * which is what this is for.
 */
export function usePull(direction: 'up' | 'down', onPull: () => void): PullHandlers {
  // Held in a ref so the handler can be built once: it goes on a memoised
  // list, and a fresh object every render would defeat it.
  const pull = useRef(onPull);
  useEffect(() => {
    pull.current = onPull;
  });

  // Whatever is listening for the current drag to end, so that unmounting
  // mid-drag does not leave it behind.
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  return useMemo(
    () => ({
      onPointerDown: (event: ReactPointerEvent) => {
        stop.current?.();
        const surface = event.currentTarget;
        // Never from a list mid-scroll — there a drag is the reader moving
        // through it — nor from a field being dragged in.
        if (
          surface.scrollTop > 0 ||
          (event.target instanceof Element && event.target.closest('input, textarea'))
        ) {
          return;
        }

        const from = { x: event.clientX, y: event.clientY };
        /*
         * The release is listened for on the window rather than on the
         * surface: a drag that travels far enough to count usually ends
         * somewhere else entirely, and with a mouse there is no implicit
         * capture to bring it back. Capturing the pointer would fix that and
         * break something else — a captured pointer hands the click to the
         * capturing element, and a tap on a row has to keep reaching the row.
         */
        const finish = (release: PointerEvent) => {
          end();
          const to = { x: release.clientX, y: release.clientY };
          const pulled = direction === 'down' ? isPullDown(from, to) : isPullUp(from, to);
          if (pulled) pull.current();
        };
        const end = () => {
          stop.current = null;
          window.removeEventListener('pointerup', finish);
          window.removeEventListener('pointercancel', end);
        };
        stop.current = end;
        window.addEventListener('pointerup', finish);
        // The browser took the gesture after all; it was never a pull.
        window.addEventListener('pointercancel', end);
      },
    }),
    [direction],
  );
}
