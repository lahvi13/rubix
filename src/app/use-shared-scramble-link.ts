import { useEffect } from 'react';
import { readShareLink } from '../domain/scramble/share-link';
import { pinSharedScramble } from '../hooks/use-pinned-scramble';

/**
 * A shared scramble arriving in the address: put on the timer, and the
 * address put back to the plain timer. Left there, the link would pin the
 * scramble again on every reload — after it had been solved, too.
 *
 * Read on a hash change as well as at start: a link tapped while the app is
 * already open in the browser moves the hash without loading anything.
 */
export function useSharedScrambleLink(): void {
  useEffect(() => {
    const take = () => {
      const shared = readShareLink(window.location.hash);
      if (shared === null) return;
      pinSharedScramble(shared);
      window.history.replaceState(window.history.state, '', '#/timer');
    };
    take();
    window.addEventListener('hashchange', take);
    return () => window.removeEventListener('hashchange', take);
  }, []);
}
