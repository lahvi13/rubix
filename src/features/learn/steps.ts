import { BEGINNER_SET_ID, CROSS_SET_ID } from '../../db/seed/packs';
import { strings } from '../../lib/strings';

export interface LearnStep {
  id: string;
  title: string;
  text: string;
  /** Where this step's cases live. */
  setId: string;
  /** The group inside that set; null means the whole set. */
  group: string | null;
  /**
   * The one algorithm the step can be got through with, repeated, and the case
   * it happens to finish in one go. Null where every case of the step has to be
   * learned — the first two layers have no shortcut of this kind.
   *
   * The rest of the step's cases are still there, a tap away. They are how the
   * step gets quick later, and showing all seven at once is how a beginner
   * decides the cube is not for them.
   */
  keyCaseId: string | null;
}

/**
 * One solve, start to finish, in the order the steps happen.
 *
 * The cases are not the guide's own: every step points at a set that already
 * exists, so a case drilled here and the same case met in the trainer are one
 * case with one set of statistics. Only the first two layers needed a set of
 * their own — this method builds them a piece at a time, which F2L does not.
 */
export const LEARN_STEPS: readonly LearnStep[] = [
  { id: 'cross', setId: CROSS_SET_ID, group: null, keyCaseId: null, ...strings.learn.steps.cross },
  {
    id: 'corners',
    setId: BEGINNER_SET_ID,
    group: 'Bottom layer corners',
    keyCaseId: null,
    ...strings.learn.steps.corners,
  },
  {
    id: 'middle',
    setId: BEGINNER_SET_ID,
    group: 'Middle layer edges',
    keyCaseId: null,
    ...strings.learn.steps.middle,
  },
  {
    id: 'edge-orientation',
    setId: '2look-oll',
    group: '1 / Edges',
    keyCaseId: '2oll-line',
    ...strings.learn.steps.edgeOrientation,
  },
  {
    id: 'corner-orientation',
    setId: '2look-oll',
    group: '2 / Corners',
    keyCaseId: '2oll-sune',
    ...strings.learn.steps.cornerOrientation,
  },
  {
    id: 'corner-permutation',
    setId: '2look-pll',
    group: '1 / Corners',
    keyCaseId: '2pll-t',
    ...strings.learn.steps.cornerPermutation,
  },
  {
    id: 'edge-permutation',
    setId: '2look-pll',
    group: '2 / Edges',
    keyCaseId: '2pll-ua',
    ...strings.learn.steps.edgePermutation,
  },
];
