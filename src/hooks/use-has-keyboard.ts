import { useSyncExternalStore } from 'react';

/**
 * A mouse or a trackpad as the main pointer, which in practice means a
 * keyboard next to it. There the timer runs on the space bar, and "hold to
 * start" alone leaves somebody pressing and holding the clock with the mouse.
 */
const QUERY = '(hover: hover) and (pointer: fine)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isFinePointer(): boolean {
  return window.matchMedia(QUERY).matches;
}

export function useHasKeyboard(): boolean {
  return useSyncExternalStore(subscribe, isFinePointer);
}
