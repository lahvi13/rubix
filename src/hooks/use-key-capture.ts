import { useEffect, useRef } from 'react';

/**
 * While something modal is open the keyboard belongs to it: the timer listens
 * on the window, and a Space meant for a menu item or a session must not start
 * a solve underneath. Propagation is stopped, never the default action, so
 * Space and Enter still activate the focused control.
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
      event.stopPropagation();
      if (event.type === 'keydown' && event.key === 'Escape') escape.current();
    };
    window.addEventListener('keydown', swallow, true);
    window.addEventListener('keyup', swallow, true);
    return () => {
      window.removeEventListener('keydown', swallow, true);
      window.removeEventListener('keyup', swallow, true);
    };
  }, [isActive]);
}
