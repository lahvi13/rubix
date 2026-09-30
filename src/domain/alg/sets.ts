/**
 * The catalogue of the built-in sets: their ids and how they relate — which
 * set is the two-look route to which, which are levels of another, the order
 * they are offered in, and how a built-in algorithm's id says what it is.
 *
 * Plain data, apart from the packs themselves (db/seed/packs.ts), so that a
 * screen can name a set without reaching into the database layer.
 */

/**
 * Which of a case's built-in algorithms a row is. The seed writes these ids and
 * the trainer reads them back to say what it is offering, so the shape of them
 * is named here rather than spelled out at both ends.
 */
export type PackAlgKind = 'main' | 'grip' | 'other' | 'slot' | 'orient';

const KIND_SUFFIX: Record<PackAlgKind, string> = {
  main: '-pack',
  grip: '-pack-grip',
  other: '-pack-other',
  slot: '-pack-slot',
  orient: '-pack-orient',
};

export function packAlgId(caseId: string, kind: PackAlgKind, index = 0): string {
  // Numbered from one, and only where there can be more than one: an id is
  // read by people often enough for that to be worth the branch.
  return kind === 'main' || kind === 'grip'
    ? `${caseId}${KIND_SUFFIX[kind]}`
    : `${caseId}${KIND_SUFFIX[kind]}-${index + 1}`;
}

/** What kind of built-in algorithm this is. Meaningless for a user's own. */
export function packAlgKind(algorithmId: string): PackAlgKind {
  if (algorithmId.endsWith(KIND_SUFFIX.grip)) return 'grip';
  if (algorithmId.includes(KIND_SUFFIX.orient)) return 'orient';
  if (algorithmId.includes(KIND_SUFFIX.slot)) return 'slot';
  if (algorithmId.includes(KIND_SUFFIX.other)) return 'other';
  return 'main';
}

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
 * Two-look cases that are the very same case in the full set: the same
 * position, read the same way, solved by the same algorithm. How far the
 * reader is with one — learning, known — is how far they are with both.
 *
 * The first look's three edge shapes are left out on purpose. Their algorithms
 * are those of OLL 45, 44 and 2, but a two-look line is any line whatever the
 * corners do, while OLL 45 is one corner pattern among several: knowing the
 * first is not yet telling the second apart from its neighbours.
 */
export const CASE_TWINS: readonly (readonly [twoLook: string, full: string])[] = [
  ['2oll-sune', 'oll-27'],
  ['2oll-antisune', 'oll-26'],
  ['2oll-h', 'oll-21'],
  ['2oll-pi', 'oll-22'],
  ['2oll-t', 'oll-24'],
  ['2oll-u', 'oll-23'],
  ['2oll-bowtie', 'oll-25'],
  ['2pll-t', 'pll-t'],
  ['2pll-y', 'pll-y'],
  ['2pll-ua', 'pll-ua'],
  ['2pll-ub', 'pll-ub'],
  ['2pll-h', 'pll-h'],
  ['2pll-z', 'pll-z'],
];

/** A case and its twin in the other set, or the case alone when it has none. */
export function withTwin(caseId: string): string[] {
  const pair = CASE_TWINS.find((twins) => twins.includes(caseId));
  return pair === undefined ? [caseId] : [...pair];
}

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
