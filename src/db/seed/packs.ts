/**
 * The built-in algorithm packs. Static data, bundled with the app — a trainer
 * that needs the network to tell you what a T perm is would be useless on a
 * plane, which is where it gets used.
 */

import f2l from './f2l.json';
import oll from './oll.json';
import pll from './pll.json';
import twoLookOll from './two-look-oll.json';
import twoLookPll from './two-look-pll.json';

export interface PackCase {
  id: string;
  name: string;
  group: string | null;
  /** The algorithm that solves the case, in standard notation. */
  alg: string;
  /**
   * State the case starts from. Left out for every case whose setup is simply
   * the algorithm undone, which is nearly all of them.
   */
  setup?: string;
  /**
   * The same case with the cube turned first, so the right hand does the work.
   * Only where such a solution exists.
   */
  alt?: string;
}

export interface AlgPack {
  packVersion: number;
  set: { id: string; name: string };
  cases: PackCase[];
}

/** Every pack is a 3x3x3 CFOP set; nothing else exists yet. */
export const PACK_PUZZLE = '333';
export const PACK_METHOD_ID = 'cfop';

export const PACKS: readonly AlgPack[] = [pll, oll, f2l, twoLookOll, twoLookPll];

/**
 * The shorter route through the same step. Two-look OLL and PLL are sets of
 * their own rather than a filter over the full ones: the first look has cases
 * that do not exist in the full set at all — three edge shapes with the
 * corners ignored — and the second look wants those cases under the names
 * people learn them by.
 */
export const TWO_LOOK_SETS: Readonly<Record<string, string>> = {
  oll: '2look-oll',
  pll: '2look-pll',
};

export const FULL_SETS: Readonly<Record<string, string>> = {
  '2look-oll': 'oll',
  '2look-pll': 'pll',
};
