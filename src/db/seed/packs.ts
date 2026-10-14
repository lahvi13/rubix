/**
 * The built-in algorithm packs. Static data, bundled with the app — a trainer
 * that needs the network to tell you what a T perm is would be useless on a
 * plane, which is where it gets used.
 */

import beginner from './beginner.json';
import cmll from './cmll.json';
import f2l from './f2l.json';
import f2lAdvanced from './f2l-advanced.json';
import f2lExpert from './f2l-expert.json';
import oll from './oll.json';
import pll from './pll.json';
import pocketOll from './pocket-oll.json';
import pocketPbl from './pocket-pbl.json';
import rouxEo from './roux-eo.json';
import rouxEolr from './roux-eolr.json';
import rouxSb from './roux-sb.json';
import twoLookCmll from './two-look-cmll.json';
import twoLookOll from './two-look-oll.json';
import twoLookPll from './two-look-pll.json';
import { CROSS_CASE_ID, CROSS_SET_ID } from '../../domain/alg/sets';
import type { Puzzle } from '../types';

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
  /**
   * Different solutions to the same case, offered beside the pack's own answer.
   * Not better ones and not rotations of it: another way through, for hands the
   * first one does not suit — a U perm without a slice turn, say, for somebody
   * who has not learned to push the middle layer yet.
   */
  others?: readonly string[];
  /**
   * Solutions that cost a slot somebody has already built. Worth knowing —
   * they are often the shortest way through — but never the one on offer by
   * default, and the case sheet says what they cost.
   */
  multiSlot?: readonly string[];
  /**
   * Solutions that orient the last layer and leave it permuted differently
   * from the pack's own answer, on the cube the case is built as. For OLL that
   * is the whole job — where the pieces end up is the next step's business —
   * and the case sheet offers them as just another way: the pack's answer only
   * leaves the cube solved because the case is built by undoing it. Kept apart
   * because the ids are, and because the drills judge them by what the set
   * looks at rather than by a solved cube (domain/recognition/angle.ts).
   */
  orientOnly?: readonly string[];
}

export interface AlgPack {
  packVersion: number;
  /** The method the set belongs to; CFOP unless it says otherwise. */
  set: { id: string; name: string; method?: string };
  /** The puzzle the set is for; the 3×3 unless it says otherwise. */
  puzzle?: Puzzle;
  cases: PackCase[];
}

/** Every pack is a 3x3x3 set; CFOP's unless the pack names another method. */
export const PACK_PUZZLE = '333';
export const PACK_METHOD_ID = 'cfop';
export const ROUX_METHOD_ID = 'roux';
export const ZZ_METHOD_ID = 'zz';

export const PACKS: readonly AlgPack[] = [
  pll,
  oll,
  f2l,
  f2lAdvanced,
  f2lExpert,
  twoLookOll,
  twoLookPll,
  beginner,
  rouxSb,
  twoLookCmll,
  cmll,
  rouxEo,
  rouxEolr,
];

/**
 * The 2×2's sets: Ortega's two, as J Perm has them (jperm.net/lib/2x2oll.js
 * and 2x2pbl.js). Apart from PACKS, because everything that reads PACKS reads
 * them as 3×3 cases — whether the layers under the case are whole, which way
 * the cube is held for recognition — and a 2×2 algorithm run on the model
 * leaves its edges wherever the moves take them. They are checked by running
 * them all the same, on the corners alone (packs.test.ts).
 */
export const POCKET_PACKS: readonly AlgPack[] = [pocketOll, pocketPbl].map((pack) => ({
  ...pack,
  puzzle: '222',
}));

/** Every set the seed puts in place, whatever puzzle it is for. */
export const SEEDED_PACKS: readonly AlgPack[] = [...PACKS, ...POCKET_PACKS];

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
