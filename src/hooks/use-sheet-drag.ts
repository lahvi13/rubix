import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { isSheetDismissed, readSheetDrag } from '../lib/swipe';

export interface SheetDragHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
}

/**
 * Dragging a sheet down by its bar until it goes, or lets go and springs back.
 *
 * The sheet follows the finger rather than waiting for the release to decide:
 * a panel that sits still under a drag and then vanishes reads as the app not
 * noticing, and one that moves shows how far is far enough.
 *
 * The transform is written straight onto the panel, outside React — it changes
 * every pointer move, and nothing else about the sheet does.
 */
export function useSheetDrag(
  panel: RefObject<HTMLElement | null>,
  onClose: () => void,
): SheetDragHandlers {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  return useMemo(
    () => ({
      onPointerDown: (event: ReactPointerEvent) => {
        stop.current?.();
        const sheet = panel.current;
        if (sheet === null || !event.isPrimary || event.button !== 0) return;
        // On a wide screen the sheet is a column down the right-hand side, and
        // down is not the way out of that.
        if (sheet.getBoundingClientRect().left > 0) return;

        const pointerId = event.pointerId;
        const from = { x: event.clientX, y: event.clientY };
        let intent: 'pull' | 'other' | null = null;
        let draggedPx = 0;
        let last = { y: event.clientY, at: event.timeStamp };
        let velocity = 0;

        const move = (moved: PointerEvent) => {
          if (moved.pointerId !== pointerId) return;
          const at = { x: moved.clientX, y: moved.clientY };
          if (intent === null) {
            intent = readSheetDrag(from, at);
            if (intent === 'other') {
              end();
              return;
            }
            if (intent === null) return;
            sheet.style.transition = 'none';
          }
          draggedPx = Math.max(0, at.y - from.y);
          sheet.style.transform = `translateY(${draggedPx}px)`;
          const elapsed = moved.timeStamp - last.at;
          if (elapsed > 0) velocity = (moved.clientY - last.y) / elapsed;
          last = { y: moved.clientY, at: moved.timeStamp };
        };

        const release = (lifted: PointerEvent) => {
          if (lifted.pointerId !== pointerId) return;
          end();
          if (intent !== 'pull') return;
          if (isSheetDismissed(draggedPx, sheet.offsetHeight, velocity)) {
            slideAway(sheet, () => close.current());
          } else {
            springBack(sheet);
          }
        };

        // The browser took the pointer after all; put the sheet back where it was.
        const cancel = (cancelled: PointerEvent) => {
          if (cancelled.pointerId !== pointerId) return;
          end();
          if (intent === 'pull') springBack(sheet);
        };

        /*
         * On the window, as `usePull` does: the release lands wherever the
         * finger got to, and capturing the pointer would hand the click of a
         * plain tap on the close button to the bar instead.
         */
        const end = () => {
          stop.current = null;
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', release);
          window.removeEventListener('pointercancel', cancel);
        };
        stop.current = end;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', cancel);
      },
    }),
    [panel],
  );
}

function prefersLessMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function springBack(sheet: HTMLElement): void {
  sheet.style.transition = prefersLessMotion()
    ? 'none'
    : 'transform var(--motion-fade) var(--motion-ease)';
  sheet.style.transform = '';
}

/**
 * Off the bottom from where the finger left it, then closed. A timer stands in
 * for `transitionend`, which never comes if the transition is cut short — and
 * a sheet that never closes is worse than one that closes a frame early.
 */
function slideAway(sheet: HTMLElement, onGone: () => void): void {
  if (prefersLessMotion()) {
    onGone();
    return;
  }
  sheet.style.transition = 'transform var(--motion-slide) var(--motion-ease)';
  sheet.style.transform = 'translateY(100%)';
  window.setTimeout(onGone, 240);
}
