import { useLiveQuery } from 'dexie-react-hooks';
import { navigate } from '../../../app/router';
import { countAllSolves } from '../../../db/repositories/solve-repository';
import type { SupportedPuzzle } from '../../../domain/puzzle/puzzles';
import { useShowLearn } from '../../../hooks/use-guide-settings';
import { useSetting, useSettingsLoaded } from '../../../hooks/use-setting';

export interface WelcomeView {
  isShown: boolean;
  /** Not yet: the guide stays on the bar, and opens. */
  learn: () => void;
  /** Already solving: the guide leaves the bar, and the timer stays up. */
  solve: () => void;
}

/**
 * The one question a new install asks: shown while there is not a solve on
 * the device, or whenever Settings asks for it again. Not before both the
 * settings and the count have answered — a card that came up and went again
 * a frame later would be the first thing an old hand ever saw of an update.
 *
 * Nobody has to answer it. The first solve is an answer of its own, and the
 * question goes with it.
 *
 * It asks about the cube the timer is switched to: knowing the 3×3 says
 * nothing of the 2×2, and each has a guide of its own to keep or put away.
 */
export function useWelcome(puzzle: SupportedPuzzle): WelcomeView {
  const [state, setState] = useSetting('ui.welcome');
  const isLoaded = useSettingsLoaded();
  const solves = useLiveQuery(countAllSolves, []);
  const [, setShowLearn] = useShowLearn(puzzle);

  const isShown =
    isLoaded && (state === 'again' || (state !== 'asked' && solves !== undefined && solves === 0));

  return {
    isShown,
    learn: () => {
      setShowLearn(true);
      setState('asked');
      navigate('learn');
    },
    solve: () => {
      setShowLearn(false);
      setState('asked');
    },
  };
}
