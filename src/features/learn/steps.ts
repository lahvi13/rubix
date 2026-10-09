import type { DiagramView, MarkedCorner } from '../../components/CubeDiagram';
import {
  BEGINNER_GROUPS,
  BEGINNER_SET_ID,
  CROSS_SET_ID,
  TWO_LOOK_CMLL_GROUPS,
  TWO_LOOK_CMLL_SET_ID,
} from '../../domain/alg/sets';
import { invertAlg, parseAlg } from '../../domain/cube/notation';
import { applyAlg, solvedState, type CubeState } from '../../domain/cube/state';
import type { Stickering } from '../../domain/cube/views';
import { strings } from '../../lib/strings';
import type { PlayerStickering } from '../trainer';

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

/**
 * A place a piece can be found in, drawn, with the moves that take it home.
 * For a step with no case of its own to show: the moves are short enough to
 * read off the picture, not an algorithm to learn.
 */
export interface LearnSituation {
  alg: string;
  text: string;
}

/**
 * How a step's situations are drawn and played: from which corner, with which
 * pieces in colour, and with the cube turned which way first. The cross is
 * looked at like F2L; Roux's blocks each have their own.
 */
export interface SituationPicture {
  view: DiagramView;
  stickering: Stickering;
  playerStickering: PlayerStickering;
  /** A whole-cube rotation before the situation is set up; empty for none. */
  standing: string;
}

const CROSS_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'cross',
  playerStickering: 'cross',
  standing: '',
};

export interface LearnStep {
  id: string;
  title: string;
  /** What to do, one action to a line. */
  points: readonly string[];
  /** The mistake that undoes the rest of the solve, said apart from the steps. */
  warning?: string;
  /** What to do when the cube is not in the picture the points assume. */
  tip?: string;
  /** Where the step's algorithms live; null for a step taught by situations alone. */
  setId: string | null;
  /** The group inside that set; null means the whole set. */
  group: string | null;
  /** The cases a beginner needs. Empty means every case of the group. */
  caseIds: readonly string[];
  /** What to look for on a step that opens with a single algorithm. */
  keyText: string | null;
  /** The other situations that same algorithm has to be run from. */
  holds: readonly LearnHold[];
  /** Where the piece can be, for a step taught by pictures instead of cases. */
  situations: readonly LearnSituation[];
  /** How those situations are drawn; the cross's way when left out. */
  picture?: SituationPicture;
  /**
   * The corner every picture of the opening algorithm frames: the one its
   * text says where to put. Not on the quicker cases, which hold no rule.
   */
  markedCorner: MarkedCorner | null;
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
    situations: [
      { alg: 'F2', text: strings.learn.crossCases.whiteUp },
      { alg: "U' R' F R", text: strings.learn.crossCases.whiteFront },
    ],
    markedCorner: null,
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
    situations: [],
    markedCorner: null,
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
    situations: [],
    markedCorner: null,
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
    situations: [],
    markedCorner: null,
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
    situations: [],
    markedCorner: 'frontLeft',
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
    situations: [],
    markedCorner: null,
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
    situations: [],
    markedCorner: null,
    advanced: { setId: '2look-pll', group: '2 / Edges' },
    ...strings.learn.steps.edgePermutation,
  },
];

/**
 * Roux, held the way its guides hold it: yellow up, the first block's blue on
 * the left and red in front — one quarter turn from how every skin is written.
 */
const ROUX_STANDING = "y'";

const LEFT_BLOCK_PICTURE: SituationPicture = {
  view: 'isometricLeft',
  stickering: 'leftBlock',
  playerStickering: 'leftBlock',
  standing: ROUX_STANDING,
};

const BLOCKS_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'blocks',
  playerStickering: 'blocks',
  standing: ROUX_STANDING,
};

const EDGE_ORIENTATION_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'lseOrientation',
  playerStickering: 'lseOrientation',
  standing: ROUX_STANDING,
};

const LAST_EDGES_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'full',
  playerStickering: 'full',
  standing: ROUX_STANDING,
};

const JB_PERM = "R U R' F' R U R' U' R' F R2 U' R' U'";

/**
 * Roux in seven steps, the way a first solve goes: two blocks built by hand,
 * the corners with the two algorithms every Roux guide starts on, and the last
 * six edges with nothing but M and U. The blocks and the edges are taught
 * from pictures, like the cross; the corners are cases out of 2-Look CMLL,
 * which is also where the quicker way through them lives.
 */
export const ROUX_STEPS: readonly LearnStep[] = [
  {
    id: 'roux-first-block',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [
      { alg: "F'", text: strings.learn.rouxSituations.frontPair },
      { alg: 'B', text: strings.learn.rouxSituations.backPair },
    ],
    picture: LEFT_BLOCK_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.rouxSteps.firstBlock,
  },
  {
    id: 'roux-second-block',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [
      { alg: "R U' R'", text: strings.learn.rouxSituations.pairInFront },
      { alg: "r' U' R", text: strings.learn.rouxSituations.pairColourUp },
    ],
    picture: BLOCKS_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.rouxSteps.secondBlock,
  },
  {
    id: 'roux-corner-orientation',
    setId: TWO_LOOK_CMLL_SET_ID,
    group: TWO_LOOK_CMLL_GROUPS.orientation,
    caseIds: ['2cmll-sune'],
    keyText: strings.learn.holds.oneOriented,
    holds: [
      { alg: `${SUNE} ${SUNE} U2 ${SUNE}`, text: strings.learn.holds.twoOriented },
      { alg: `${SUNE} ${SUNE}`, text: strings.learn.holds.noneOriented },
    ],
    situations: [],
    markedCorner: 'frontLeft',
    advanced: { setId: TWO_LOOK_CMLL_SET_ID, group: TWO_LOOK_CMLL_GROUPS.orientation },
    ...strings.learn.rouxSteps.cornerOrientation,
  },
  {
    id: 'roux-corner-permutation',
    setId: TWO_LOOK_CMLL_SET_ID,
    group: TWO_LOOK_CMLL_GROUPS.permutation,
    caseIds: ['2cmll-jb'],
    keyText: strings.learn.rouxHolds.headlightsLeft,
    holds: [{ alg: `${JB_PERM} U2 ${JB_PERM}`, text: strings.learn.holds.noHeadlights }],
    situations: [],
    markedCorner: null,
    advanced: { setId: TWO_LOOK_CMLL_SET_ID, group: TWO_LOOK_CMLL_GROUPS.permutation },
    ...strings.learn.rouxSteps.cornerPermutation,
  },
  {
    id: 'roux-edge-orientation',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [{ alg: "M' U M", text: strings.learn.rouxSituations.arrow }],
    picture: EDGE_ORIENTATION_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.rouxSteps.edgeOrientation,
  },
  {
    id: 'roux-side-edges',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [{ alg: "U M2 U'", text: strings.learn.rouxSituations.sideEdgesDown }],
    picture: LAST_EDGES_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.rouxSteps.sideEdges,
  },
  {
    id: 'roux-middle-slice',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [
      { alg: 'U2 M2 U2 M2', text: strings.learn.rouxSituations.twoSwaps },
      { alg: "U2 M' U2 M'", text: strings.learn.rouxSituations.threeCycle },
    ],
    picture: LAST_EDGES_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.rouxSteps.middleSlice,
  },
];

/** A guide per method, by the method's id. */
export const GUIDES: Readonly<Record<string, readonly LearnStep[]>> = {
  cfop: LEARN_STEPS,
  roux: ROUX_STEPS,
};

/** How a step's situations are drawn: its own picture, or the cross's. */
export function situationPicture(step: LearnStep): SituationPicture {
  return step.picture ?? CROSS_PICTURE;
}

/** The cube as the reader meets it: stood as the step holds it, then the way out undone. */
export function holdState(hold: LearnHold, standing = ''): CubeState {
  const turn = parseAlg(standing);
  const stood = turn.ok ? applyAlg(solvedState(), turn.moves) : solvedState();
  const way = parseAlg(hold.alg);
  return way.ok ? applyAlg(stood, invertAlg(way.moves)) : stood;
}
