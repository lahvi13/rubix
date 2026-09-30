import { BEGINNER_GROUPS, BEGINNER_SET_ID, CROSS_SET_ID } from '../../domain/alg/sets';
import { invertAlg, parseAlg } from '../../domain/cube/notation';
import { applyAlg, solvedState, type CubeState } from '../../domain/cube/state';
import { strings } from '../../lib/strings';

/**
 * A situation the step's one algorithm has to be repeated from: a picture and
 * what to look for. Held as the way out rather than as the state it gets you
 * out of, because that is the thing worth checking — the picture is whatever
 * this algorithm, run as many times as it says, undoes.
 */
export interface LearnHold {
  alg: string;
  text: string;
}

export interface LearnStep {
  id: string;
  title: string;
  text: string;
  /** Where the step's algorithms live. */
  setId: string;
  /** The group inside that set; null means the whole set. */
  group: string | null;
  /** The cases a beginner needs. Empty means every case of the group. */
  caseIds: readonly string[];
  /** What to look for on a step that opens with a single algorithm. */
  keyText: string | null;
  /** The other situations that same algorithm has to be run from. */
  holds: readonly LearnHold[];
  /**
   * The same step for somebody who wants it fast: every case with an algorithm
   * of its own, usually out of a different set. Null where the step is already
   * as short as it gets.
   */
  advanced: { setId: string; group: string } | null;
}

const SUNE = "R U R' U R U2 R'";
const A_PERM = "R' F R' B2 R F' R' B2 R2";
const U_PERM = "R U' R U R U R U' R' U' R2";

/**
 * One solve, start to finish, in the order the steps happen.
 *
 * The last four steps each open on **one** algorithm, because that is what
 * makes the cube solvable in an afternoon: hold it as the picture says, run it,
 * look again. Everything else the step could be is a tap away, and the two
 * things are not in competition — one is how you start, the other is how it
 * gets quick.
 */
export const LEARN_STEPS: readonly LearnStep[] = [
  {
    id: 'cross',
    setId: CROSS_SET_ID,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    advanced: null,
    ...strings.learn.steps.cross,
  },
  {
    id: 'corners',
    setId: BEGINNER_SET_ID,
    group: BEGINNER_GROUPS.corners,
    caseIds: [],
    keyText: null,
    holds: [],
    advanced: null,
    ...strings.learn.steps.corners,
  },
  {
    id: 'middle',
    setId: BEGINNER_SET_ID,
    group: BEGINNER_GROUPS.edges,
    caseIds: [],
    keyText: null,
    holds: [],
    advanced: null,
    ...strings.learn.steps.middle,
  },
  {
    id: 'edge-orientation',
    setId: '2look-oll',
    group: '1 / Edges',
    caseIds: [],
    keyText: null,
    holds: [],
    advanced: null,
    ...strings.learn.steps.edgeOrientation,
  },
  {
    id: 'corner-orientation',
    setId: '2look-oll',
    group: '2 / Corners',
    caseIds: ['2oll-sune'],
    keyText: strings.learn.holds.oneOriented,
    holds: [
      { alg: `${SUNE} ${SUNE} U2 ${SUNE}`, text: strings.learn.holds.twoOriented },
      { alg: `${SUNE} ${SUNE}`, text: strings.learn.holds.noneOriented },
    ],
    advanced: { setId: '2look-oll', group: '2 / Corners' },
    ...strings.learn.steps.cornerOrientation,
  },
  {
    id: 'corner-permutation',
    setId: BEGINNER_SET_ID,
    group: BEGINNER_GROUPS.cornersHome,
    caseIds: [],
    keyText: strings.learn.holds.headlights,
    holds: [{ alg: `${A_PERM} U ${A_PERM} U'`, text: strings.learn.holds.noHeadlights }],
    advanced: { setId: '2look-pll', group: '1 / Corners' },
    ...strings.learn.steps.cornerPermutation,
  },
  {
    id: 'edge-permutation',
    setId: BEGINNER_SET_ID,
    group: BEGINNER_GROUPS.edgesHome,
    caseIds: [],
    keyText: strings.learn.holds.oneSide,
    holds: [{ alg: `${U_PERM} U ${U_PERM} U'`, text: strings.learn.holds.noSide }],
    advanced: { setId: '2look-pll', group: '2 / Edges' },
    ...strings.learn.steps.edgePermutation,
  },
];

/** The cube as the reader meets it: the way out, undone. */
export function holdState(hold: LearnHold): CubeState {
  const parsed = parseAlg(hold.alg);
  return parsed.ok ? applyAlg(solvedState(), invertAlg(parsed.moves)) : solvedState();
}
