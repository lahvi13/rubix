import { useLiveQuery } from 'dexie-react-hooks';
import { navigate } from '../../../app/router';
import { getOrCreateActiveSession, setMethodWhileEmpty } from '../../../db/repositories/session-repository';
import { countAllSolves } from '../../../db/repositories/solve-repository';
import { useLastGuide, useShowLearn } from '../../../hooks/use-guide-settings';
import { useSetting, useSettingsLoaded } from '../../../hooks/use-setting';
import { welcomePlan, type WelcomeAnswer } from '../../../domain/welcome/plan';

export interface WelcomeView {
  isShown: boolean;
  /** Set the app up as the answer says, and go where it leads. */
  answer: (answer: WelcomeAnswer) => Promise<void>;
  /** Not now, and not again: Settings can start it over. */
  skip: () => void;
}

/**
 * The two questions a new install asks: shown once there is not a solve on
 * the device, or whenever Settings asks for them again. Not before both the
 * settings and the count have answered — a sheet that came up and went again
 * a frame later would be the first thing an old hand ever saw of an update.
 */
export function useWelcome(): WelcomeView {
  const [state, setState] = useSetting('ui.welcome');
  const isLoaded = useSettingsLoaded();
  const solves = useLiveQuery(countAllSolves, []);
  // The questions are about the 3×3, the cube the app starts on.
  const [, setShowLearn] = useShowLearn('333');
  const [, setGuide] = useLastGuide('333');
  const [, setPuzzle] = useSetting('ui.puzzle');
  const [, setTrainerSet] = useSetting('trainer.setId');
  const [, setTwoLook] = useSetting('trainer.twoLookDefault');

  // A value from a newer build reads as a fresh install's.
  const isShown =
    isLoaded && (state === 'again' || (state !== 'asked' && solves !== undefined && solves === 0));

  return {
    isShown,
    answer: async (answer) => {
      const plan = welcomePlan(answer);
      setPuzzle('333');
      setShowLearn(plan.showLearn);
      setGuide(plan.guide);
      if (plan.trainerSetId !== null) {
        setTrainerSet(plan.trainerSetId);
        setTwoLook(true);
      }
      const session = await getOrCreateActiveSession('333', 'freestyle');
      await setMethodWhileEmpty(session.id, plan.sessionMethod);
      setState('asked');
      navigate(plan.screen);
    },
    skip: () => setState('asked'),
  };
}
