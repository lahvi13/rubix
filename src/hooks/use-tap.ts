import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * How far a finger may wander and still have tapped. A fingertip is never
 * quite still; much further than this and it was dragging.
 */
const TAP_SLOP_PX = 10;

interface TapHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

/**
 * A tap on a turning cube, told apart from a drag. Dragging the cube turns it
 * round to look at, and a click cannot say which of the two it was: the player
 * holds the pointer while it is dragged, so the click still arrives.
 *
 * Taps on a button inside the area are the button's own.
 */
export function useTap(onTap: () => void): TapHandlers {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);

  return {
    onPointerDown: (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event) => {
      const from = start.current;
      start.current = null;
      if (from === null || from.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP_PX) return;
      if (event.target instanceof Element && event.target.closest('button')) return;
      onTap();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
