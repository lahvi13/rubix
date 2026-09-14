import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Route } from './router';

/**
 * How long a screen gets to grow back to where it was left. Most screens draw
 * from live queries, so the first frame is shorter than the page the reader
 * scrolled — a position further down than that frame reaches has to wait for
 * the rest of it.
 */
const RESTORE_WINDOW_MS = 2000;

/** Any of these is the reader taking the page over, and they win over the put-back. */
const TAKEOVER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * Every screen scrolls the one document, so left alone they would share one
 * scroll position: the stats left at the bottom open the settings at the
 * bottom too, and the settings forget where they were. Each route keeps its
 * own, for as long as the app is open.
 */
export function useScrollMemory(route: Route): void {
  const positions = useRef(new Map<Route, number>());
  const shown = useRef(route);
  // While the page is being put back, a scroll event is the page's own doing,
  // or the browser clamping a position the new screen is too short for.
  const isRestoring = useRef(false);

  useEffect(() => {
    // The browser's own restoration moves the page on a back press before the
    // router has swapped the screen, and that position would be recorded
    // against the screen being left.
    window.history.scrollRestoration = 'manual';

    const onScroll = () => {
      if (!isRestoring.current) positions.current.set(shown.current, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Before paint, or the new screen flashes at the old one's position first.
  useLayoutEffect(() => {
    if (shown.current === route) return;
    shown.current = route;
    isRestoring.current = true;
    return putBack(positions.current.get(route) ?? 0, () => {
      isRestoring.current = false;
      positions.current.set(route, window.scrollY);
    });
  }, [route]);
}

/** Scrolls to `y` as soon as the page is tall enough; returns the cancel. */
function putBack(y: number, onDone: () => void): () => void {
  let isDone = false;

  const attempt = () => {
    window.scrollTo({ top: y, behavior: 'instant' });
    if (Math.abs(window.scrollY - y) <= 1) finish();
  };
  const observer = new ResizeObserver(attempt);
  const timeout = window.setTimeout(() => finish(), RESTORE_WINDOW_MS);

  function stop() {
    isDone = true;
    observer.disconnect();
    window.clearTimeout(timeout);
    for (const type of TAKEOVER_EVENTS) window.removeEventListener(type, finish, true);
  }

  function finish() {
    if (isDone) return;
    stop();
    onDone();
  }

  for (const type of TAKEOVER_EVENTS) {
    window.addEventListener(type, finish, { capture: true, passive: true });
  }
  observer.observe(document.body);
  attempt();

  // Cancelled by the next route change: nothing to record, the page on screen
  // is already a different one.
  return () => {
    if (!isDone) stop();
  };
}
