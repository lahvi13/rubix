import { useEffect, useRef } from 'react';
import { isTypingTarget } from '../lib/typing-target';

/**
 * While something modal is open the keyboard belongs to it: the timer listens
 * on the window, and a Space meant for a menu item or a session must not start
 * a solve underneath. Propagation is stopped, never the default action, so
 * Space and Enter still activate the focused control.
 *
 * A text field keeps its keys, though: stopped at the window, they never
 * reached the field's own handler, and Enter in a sheet's field did nothing.
 * The timer and the playback keys pass over a typing target by themselves.
 * Escape from a field closes the panel only if the field left it alone —
 * cancelling a rename is the field's business, not the whole picker's.
 */
export function useKeyCapture(isActive: boolean, onEscape: () => void): void {
  // Held in a ref so a caller may pass an inline closure without the listeners
  // being torn down and registered again on every render.
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });

  useEffect(() => {
    if (!isActive) return;
    const swallow = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      event.stopPropagation();
      if (event.type === 'keydown' && event.key === 'Escape') escape.current();
    };
    // Bubbling, so it only hears an Escape the field did not stop.
    const escapeFromField = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTypingTarget(event.target)) escape.current();
    };
    window.addEventListener('keydown', swallow, true);
    window.addEventListener('keyup', swallow, true);
    window.addEventListener('keydown', escapeFromField);
    return () => {
      window.removeEventListener('keydown', swallow, true);
      window.removeEventListener('keyup', swallow, true);
      window.removeEventListener('keydown', escapeFromField);
    };
  }, [isActive]);
}
