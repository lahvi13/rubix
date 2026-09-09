import { useEffect, useRef } from 'react';
import { holdBackForSheet } from '../lib/sheet-history';

/**
 * Closes the sheet on the back gesture. On a phone that is the reflex — the
 * panel covers the screen, so back reads as "out of this", not "back a page".
 */
export function useBackToClose(onClose: () => void): void {
  // Held in a ref so an inline closure does not push and release an entry on
  // every render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => holdBackForSheet(() => close.current()), []);
}
