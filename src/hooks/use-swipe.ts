import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { readSwipe, type SwipeDirection } from '../lib/swipe';

export interface SwipeHandlers {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: () => void;
}

/** How far across a drag has to get before the page starts to follow it. */
const SLOP_PX = 8;

/**
 * How much of a drag the page follows when there is nothing that way. It still
 * moves, so the reader feels the end of the sequence instead of a dead panel.
 */
const RESISTANCE = 0.3;

/**
 * Turns a drag across the panel into a step through whatever it is one of,
 * with the page under the bar following the finger until it is let go.
 *
 * Two things get to keep their own drags and are skipped by name: a text field,
 * where dragging places the caret, and anything marked `data-no-swipe` — the
 * twisty player is turned by dragging it, and a swipe that spun the cube
 * instead of turning the page would be maddening.
 */
export function useSwipe(
  panel: RefObject<HTMLElement | null>,
  canStep: (direction: SwipeDirection) => boolean,
  onSwipe: (direction: SwipeDirection) => void,
): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);
  const isFollowing = useRef(false);

  const settle = () => {
    if (isFollowing.current && panel.current !== null) springBack(panel.current);
    isFollowing.current = false;
  };

  return {
    onPointerDown: (event) => {
      const target = event.target;
      isFollowing.current = false;
      if (
        !event.isPrimary ||
        (target instanceof Element && target.closest('input, textarea, [data-no-swipe]'))
      ) {
        start.current = null;
        return;
      }
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerMove: (event) => {
      const from = start.current;
      const sheet = panel.current;
      if (from === null || sheet === null) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;

      if (!isFollowing.current) {
        if (Math.abs(dx) < SLOP_PX) return;
        // Mostly down: a scroll, which the browser is about to take anyway.
        if (Math.abs(dx) < Math.abs(dy) * 2) {
          start.current = null;
          return;
        }
        isFollowing.current = true;
      }
      const direction: SwipeDirection = dx < 0 ? 'next' : 'previous';
      shiftPage(sheet, canStep(direction) ? dx : dx * RESISTANCE);
    },
    onPointerUp: (event) => {
      const from = start.current;
      start.current = null;
      if (from === null) {
        settle();
        return;
      }

      const direction = readSwipe(from, { x: event.clientX, y: event.clientY }, {
        width: window.innerWidth,
      });
      if (direction !== null && canStep(direction)) {
        isFollowing.current = false;
        onSwipe(direction);
      } else {
        settle();
      }
    },
    // The browser takes the pointer away the moment it starts scrolling with
    // it; what it took was never a swipe.
    onPointerCancel: () => {
      start.current = null;
      settle();
    },
  };
}

/** Everything in the panel but the bar, which stays put while the page moves. */
function pageOf(sheet: HTMLElement): HTMLElement[] {
  return [...sheet.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !child.classList.contains('sheet__bar'),
  );
}

/*
 * Written onto the page's own elements and cleared after, rather than kept in
 * the stylesheet: any translate, even a zero one, makes an element the
 * containing block of everything fixed inside it.
 */
function shiftPage(sheet: HTMLElement, px: number): void {
  for (const element of pageOf(sheet)) {
    element.style.transition = 'none';
    element.style.translate = `${px}px 0`;
  }
}

function springBack(sheet: HTMLElement): void {
  for (const element of pageOf(sheet)) {
    element.style.transition = prefersLessMotion()
      ? ''
      : 'translate var(--motion-fade) var(--motion-ease)';
    element.style.translate = '';
  }
}

/** A CSS time in milliseconds. The minifier writes `240ms` as `.24s`. */
function toMs(value: string): number | null {
  const time = value.trim();
  const amount = Number.parseFloat(time);
  if (!Number.isFinite(amount)) return null;
  if (time.endsWith('ms')) return amount;
  return time.endsWith('s') ? amount * 1000 : null;
}

function prefersLessMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** How far in from the side a new page starts, as a share of the panel. */
const ENTRY_SHARE = 0.4;

/**
 * The page that has just been stepped to comes in from the side it was pulled
 * from: the next one from the right, the one before from the left. The way the
 * sequence lies, said without a word.
 */
export function slideIn(sheet: HTMLElement, direction: SwipeDirection): void {
  const page = pageOf(sheet);
  for (const element of page) {
    element.style.transition = '';
    element.style.translate = '';
  }
  if (prefersLessMotion() || typeof sheet.animate !== 'function') return;

  const style = getComputedStyle(sheet);
  const duration = toMs(style.getPropertyValue('--motion-slide')) ?? 240;
  const easing = style.getPropertyValue('--motion-ease').trim() || 'ease-out';
  const fromPx = sheet.clientWidth * ENTRY_SHARE * (direction === 'next' ? 1 : -1);
  for (const element of page) {
    element.animate(
      [
        { translate: `${fromPx}px 0`, opacity: 0 },
        { translate: '0 0', opacity: 1 },
      ],
      { duration, easing },
    );
  }
}
