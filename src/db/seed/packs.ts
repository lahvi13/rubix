/**
 * The built-in algorithm packs. Static data, bundled with the app — a trainer
 * that needs the network to tell you what a T perm is would be useless on a
 * plane, which is where it gets used.
 */

import beginner from './beginner.json';
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

export const PACKS: readonly AlgPack[] = [pll, oll, f2l, twoLookOll, twoLookPll, beginner];

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

/**
 * The order the sets are offered in: the order they come up in a solve, not
 * the alphabet. A trainer sorted A to Z puts the last layer before the cross,
 * which is not how anybody works through a solve.
 */
export const SET_ORDER: readonly string[] = [
  'cross',
  'beginner',
  'f2l',
  '2look-oll',
  'oll',
  '2look-pll',
  'pll',
];

/**
 * The first two layers the way the beginner's guide teaches them: a corner at
 * a time, then an edge at a time. Kept apart from F2L, which solves both at
 * once and is a different skill, not a better version of this one.
 */
export const BEGINNER_SET_ID = 'beginner';

export const CROSS_SET_ID = 'cross';
export const CROSS_CASE_ID = 'cross';

/**
 * The cross is drilled too, and it is not an algorithm set: there is nothing
 * to recognise and no algorithm to look up, only a real scramble and the
 * first step of the solve. It still gets a set and a case row, because a
 * drill attempt points at a case and that is what per-case statistics are
 * keyed by — an attempt hanging off an id with no row behind it would be a
 * dangling reference nobody could clean up.
 *
 * It is kept out of PACKS: those are lists of algorithms, checked by running
 * them, and this one has none.
 */
export const CROSS_PACK: AlgPack = {
  packVersion: 1,
  set: { id: CROSS_SET_ID, name: 'Cross' },
  cases: [{ id: CROSS_CASE_ID, name: 'Cross', group: null, alg: '', setup: '' }],
};
