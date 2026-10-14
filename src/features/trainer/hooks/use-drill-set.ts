import type { AlgSet } from '../../../db/types';
import { SETTING_DEFAULTS } from '../../../db/repositories/settings-repository';
import { usePuzzle } from '../../../hooks/use-puzzle';
import { useSetting } from '../../../hooks/use-setting';
import { useAlgSets } from './use-alg-cases';

export interface DrillSet {
  /** The set the drill draws from: the one last chosen, if it is this cube's. */
  setId: string;
  setSetId: (setId: string) => void;
  /** The sets of the cube the app is on, or undefined while they are read. */
  sets: AlgSet[] | undefined;
}

/**
 * Which set the drill draws from, on the cube the app is on. The choice is
 * one setting for every cube, so a set of the other one — PLL, with the app
 * on the 2×2 — stands for that cube's first set rather than drilling a case
 * the screen has no business with. The setting itself is left alone: back on
 * the cube it belongs to, it is the set again.
 */
export function useDrillSet(): DrillSet {
  const [puzzle] = usePuzzle();
  const all = useAlgSets();
  const sets = all?.filter((set) => set.puzzle === puzzle);
  const [stored, setSetId] = useSetting('trainer.drillSetId');

  const isOwn = sets === undefined || sets.some((set) => set.id === stored);
  const fallback =
    puzzle === '333' ? SETTING_DEFAULTS['trainer.drillSetId'] : (sets?.[0]?.id ?? stored);
  return { setId: isOwn ? stored : fallback, setSetId, sets };
}
