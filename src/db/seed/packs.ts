/**
 * The built-in algorithm packs. Static data, bundled with the app — a trainer
 * that needs the network to tell you what a T perm is would be useless on a
 * plane, which is where it gets used.
 */

import beginner from './beginner.json';
import f2l from './f2l.json';
import f2lAdvanced from './f2l-advanced.json';
import f2lExpert from './f2l-expert.json';
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
}

export interface AlgPack {
  packVersion: number;
  set: { id: string; name: string };
  cases: PackCase[];
}

/** Every pack is a 3x3x3 CFOP set; nothing else exists yet. */
export const PACK_PUZZLE = '333';
export const PACK_METHOD_ID = 'cfop';

/**
 * Which of a case's built-in algorithms a row is. The seed writes these ids and
 * the trainer reads them back to say what it is offering, so the shape of them
 * is named here rather than spelled out at both ends.
 */
export type PackAlgKind = 'main' | 'grip' | 'other' | 'slot';

const KIND_SUFFIX: Record<PackAlgKind, string> = {
  main: '-pack',
  grip: '-pack-grip',
  other: '-pack-other',
  slot: '-pack-slot',
};

export function packAlgId(caseId: string, kind: PackAlgKind, index = 0): string {
  // Numbered from one, and only where there can be more than one: an id is
  // read by people often enough for that to be worth the branch.
  return kind === 'other' || kind === 'slot'
    ? `${caseId}${KIND_SUFFIX[kind]}-${index + 1}`
    : `${caseId}${KIND_SUFFIX[kind]}`;
}

/** What kind of built-in algorithm this is. Meaningless for a user's own. */
export function packAlgKind(algorithmId: string): PackAlgKind {
  if (algorithmId.endsWith(KIND_SUFFIX.grip)) return 'grip';
  if (algorithmId.includes(KIND_SUFFIX.slot)) return 'slot';
  if (algorithmId.includes(KIND_SUFFIX.other)) return 'other';
  return 'main';
}

export const PACKS: readonly AlgPack[] = [
  pll,
  oll,
  f2l,
  f2lAdvanced,
  f2lExpert,
  twoLookOll,
  twoLookPll,
  beginner,
];

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

/**
 * F2L, further in. The forty-one basic cases assume every other slot is
 * already built; these two sets are what happens when one is not — a piece of
 * the pair sitting in a slot of its own (advanced), or both of them down there
 * (expert). Sets rather than groups, so the screen somebody opens to look up
 * a basic case is still forty-one cards rather than ninety-four.
 *
 * In the order they are offered, the basic set first.
 */
export const SET_LEVELS: Readonly<Record<string, readonly string[]>> = {
  f2l: ['f2l', 'f2l-advanced', 'f2l-expert'],
};

/** Which set each level hangs off, for the row that names the sets. */
export const LEVEL_BASE_SETS: Readonly<Record<string, string>> = {
  'f2l-advanced': 'f2l',
  'f2l-expert': 'f2l',
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
  'f2l-advanced',
  'f2l-expert',
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

/**
 * The steps of the beginner set, as its cases are grouped. Named here because
 * three places have to agree on them: the pack, how each is drawn, and the
 * guide that walks them in order.
 */
export const BEGINNER_GROUPS = {
  corners: 'Bottom layer corners',
  edges: 'Middle layer edges',
  cornersHome: 'Corners home',
  edgesHome: 'Edges home',
} as const;

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
