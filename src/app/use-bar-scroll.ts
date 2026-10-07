import { useEffect, useRef, useState } from 'react';
import { BAR_SHOWN, scrollBar, type BarScroll } from '../lib/bar-visibility';
import type { Route } from './router';

/** The reader taking the page over, as `useScrollMemory` reads it too. */
const READER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * Whether the bottom bar is up: away while the reader scrolls down through a
 * page, back when they head up or reach the top, and up again on every screen
 * they arrive at.
 *
 * Only the reader's own scrolling moves it. A screen that is opened is put
 * back where it was left (see `useScrollMemory`), which can take a couple of
 * seconds of the page moving on its own — read as scrolling down, that hid
 * the bar on arrival.
 */
export function useBarScroll(route: Route): boolean {
  // Kept with the screen it was decided on: a screen just arrived at has not
  // been scrolled yet, so whatever the last one did, the bar is up.
  const [bar, setBar] = useState({ route, isShown: true });
  const state = useRef<BarScroll>(BAR_SHOWN);
  const isReading = useRef(false);

  useEffect(() => {
    const anchor = () => {
      state.current = { anchorY: window.scrollY, lastY: window.scrollY, isShown: true };
    };
    anchor();
    isReading.current = false;

    const onReader = () => {
      if (isReading.current) return;
      isReading.current = true;
      anchor();
    };
    const onScroll = () => {
      if (!isReading.current) {
        anchor();
        return;
      }
      state.current = scrollBar(state.current, window.scrollY);
      const isShown = state.current.isShown;
      setBar((current) =>
        current.route === route && current.isShown === isShown ? current : { route, isShown },
      );
    };

    for (const type of READER_EVENTS) {
      window.addEventListener(type, onReader, { capture: true, passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      for (const type of READER_EVENTS) window.removeEventListener(type, onReader, true);
      window.removeEventListener('scroll', onScroll);
    };
  }, [route]);

  return bar.route === route ? bar.isShown : true;
}
