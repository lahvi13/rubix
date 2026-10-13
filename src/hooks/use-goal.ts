import { GOAL_SETTING } from '../db/repositories/settings-repository';
import type { SupportedPuzzle } from '../domain/puzzle/puzzles';
import { useSetting } from './use-setting';

/** The time being chased on one cube, 0 for none, and the way to set it. */
export function useGoalMs(puzzle: SupportedPuzzle): [number, (goalMs: number) => void] {
  return useSetting(GOAL_SETTING[puzzle]);
}
