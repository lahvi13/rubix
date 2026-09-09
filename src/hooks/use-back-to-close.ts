import { useEffect, useRef } from 'react';
import { holdBackForPanel } from '../lib/sheet-history';

/**
 * Closes the panel on the back gesture. On a phone that is the reflex â the
 * panel covers the screen, so back reads as "out of this", not "back a page".
 *
 * `isActive` is for a panel that lives in a screen rather than being mounted
 * when it opens: holding the entry while nothing is open would spend a back
 * press closing something the reader cannot see.
 */
export function useBackToClose(onClose: () => void, isActive = true): void {
  // Held in a ref so an inline closure does not push and release an entry on
  // every render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!isActive) return;
    return holdBackForPanel(() => close.current());
  }, [isActive]);
}
