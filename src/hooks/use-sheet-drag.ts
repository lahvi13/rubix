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
  bar: RefObject<HTMLElement | null>,
  scrim: RefObject<HTMLElement | null>,
  onClose: () => void,
): SheetDragHandlers {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  /*
   * A drag the sheet follows is the sheet's alone, and the browser is told so
   * by cancelling its touchmoves. Left to itself, Chrome on Android reads a
   * quick release as a fling — touch-action none or not — and the next tap,
   * on the card the reader is reaching for, only stops that fling: measured,
   * a tap 300 ms after a fast drag was lost and one after a still release was
   * not. Its touchend cannot be cancelled instead; over touch-action none it
   * arrives uncancelable. A listener of our own on the bar, not passive,
   * because one passed through React would be.
   */
  const isPulling = useRef(false);
  useEffect(() => {
    const surface = bar.current;
    if (surface === null) return;
    const hold = (event: TouchEvent) => {
      if (isPulling.current && event.cancelable) event.preventDefault();
    };
    surface.addEventListener('touchmove', hold, { passive: false });
    return () => surface.removeEventListener('touchmove', hold);
  }, [bar]);

  return useMemo(
    () => ({
      onPointerDown: (event: ReactPointerEvent) => {
        stop.current?.();
        const sheet = panel.current;
        if (sheet === null || !event.isPrimary || event.button !== 0) return;
        // On a wide screen the sheet is a column down the right-hand side,
        // floor to ceiling, and down is not the way out of that. Told by its
        // top rather than its left: the More card stands clear of both edges
        // and is still dragged down like any sheet.
        if (sheet.getBoundingClientRect().top <= 0) return;

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
            isPulling.current = true;
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
            slideAway(sheet, scrim.current, () => close.current());
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
          isPulling.current = false;
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
    [panel, scrim],
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
 *
 * Gone as far as the reader is concerned from the moment it is let go: the
 * wash stops catching touches and fades with it, and a touch that lands before
 * the slide is over closes it there and then, so a tap aimed at the card under
 * it reaches the card. Left mounted and catching, the first tap after a quick
 * drag only finished closing the sheet.
 */
function slideAway(sheet: HTMLElement, scrim: HTMLElement | null, onGone: () => void): void {
  if (prefersLessMotion()) {
    onGone();
    return;
  }
  let isGone = false;
  const finish = () => {
    if (isGone) return;
    isGone = true;
    window.clearTimeout(timer);
    window.removeEventListener('pointerdown', finish, true);
    onGone();
  };
  sheet.style.pointerEvents = 'none';
  sheet.style.transition = 'transform var(--motion-slide) var(--motion-ease)';
  sheet.style.transform = 'translateY(100%)';
  if (scrim !== null) {
    scrim.style.pointerEvents = 'none';
    scrim.style.transition = 'opacity var(--motion-slide) var(--motion-ease)';
    scrim.style.opacity = '0';
  }
  window.addEventListener('pointerdown', finish, true);
  const timer = window.setTimeout(finish, 240);
}
