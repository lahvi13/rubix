import { useLiveQuery } from 'dexie-react-hooks';
import { countAllSolves } from '../../../db/repositories/solve-repository';
import { useSetting } from '../../../hooks/use-setting';
import { useInstall } from './use-install';

/**
 * Solves before the nudge shows. Enough that the app is being used rather than
 * looked at — a first visit is not the moment to ask for the home screen — and
 * few enough that a week away still has little to lose.
 */
export const INSTALL_NUDGE_AFTER_SOLVES = 5;

export interface InstallNudge {
  isShown: boolean;
  dismiss: () => void;
}

/**
 * Safari on iOS drops a site's storage after seven days without a visit, and
 * a tab is where most people first try an app. Installed, the week does not
 * apply — so the one browser that has no install button is the one that gets
 * told, on the screen where the solves are being made.
 */
export function useInstallNudge(): InstallNudge {
  const state = useInstall();
  const [isDismissed, setDismissed] = useSetting('ui.installNudgeDismissed');
  const isCandidate = state === 'manual' && !isDismissed;
  // Not asked at all where the nudge can never show: the count runs again
  // after every solve.
  const solves = useLiveQuery(() => (isCandidate ? countAllSolves() : 0), [isCandidate]);

  return {
    isShown: isCandidate && (solves ?? 0) >= INSTALL_NUDGE_AFTER_SOLVES,
    dismiss: () => setDismissed(true),
  };
}
