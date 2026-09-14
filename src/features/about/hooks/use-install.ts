import { useSyncExternalStore } from 'react';
import { installState, subscribeInstall, type InstallState } from '../../../lib/install';

/**
 * What the install section has to say, kept in step with the browser: the
 * offer can arrive after the screen is already on, and it goes away the moment
 * it is taken.
 */
export function useInstall(): InstallState {
  return useSyncExternalStore(subscribeInstall, installState, serverState);
}

/** Nothing is installed while there is no window; only jsdom ever asks. */
function serverState(): InstallState {
  return 'none';
}
