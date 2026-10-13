import {
  LAST_GUIDE_SETTING,
  SHOW_LEARN_SETTING,
} from '../db/repositories/settings-repository';
import type { SupportedPuzzle } from '../domain/puzzle/puzzles';
import { useSetting } from './use-setting';

/**
 * Whether a cube's guide is offered in the menu. One switch per cube: somebody
 * who put the 3×3's guide away years ago is a beginner again on the 2×2.
 */
export function useShowLearn(puzzle: SupportedPuzzle): [boolean, (isShown: boolean) => void] {
  return useSetting(SHOW_LEARN_SETTING[puzzle]);
}

/** The guide of a cube that was read last; empty until one has been picked. */
export function useLastGuide(puzzle: SupportedPuzzle): [string, (guideId: string) => void] {
  return useSetting(LAST_GUIDE_SETTING[puzzle]);
}
