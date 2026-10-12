import type { DiagramView, MarkedCorner } from '../../components/CubeDiagram';
import {
  BEGINNER_GROUPS,
  BEGINNER_SET_ID,
  CROSS_SET_ID,
  ROUX_EO_GROUPS,
  ROUX_EO_SET_ID,
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
  /**
   * What the step goes on to do once `alg` is done, where `alg` only gets the
   * cube as far as the next picture. Never shown: it is there so the cube is
   * drawn as it is met in a solve, a few turns short of the step's end.
   */
  next?: string;
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

/** What a step builds, drawn finished: the thing its moves add up to. */
export interface LearnGoal {
  picture: SituationPicture;
  caption: string;
}

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
  /** The finished thing, for a step that builds something a sentence cannot show. */
  goal?: LearnGoal;
  /**
   * The corner every picture of the opening algorithm frames: the one its
   * text says where to put. Not on the quicker cases, which hold no rule.
   */
  markedCorner: MarkedCorner | null;
  /**
   * The same step for somebody who wants it fast: every case with an algorithm
   * of its own, usually out of a different set. Null where the step is already
   * as short as it gets; a null group is the whole set.
   */
  advanced: { setId: string; group: string | null } | null;
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
    // The whole cube unfolded: a cross is right when every edge matches the
    // side it stands under, and no single corner shows all four.
    goal: {
      picture: { view: 'net', stickering: 'cross', playerStickering: 'cross', standing: '' },
      caption: strings.learn.crossCaption,
    },
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

/** The six edges as edge orientation reads them, like the arrow's own case. */
const EDGE_FLIP_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'lseOrientation',
  playerStickering: 'lseOrientation',
  standing: ROUX_STANDING,
};

const SIDE_EDGES_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'sideEdges',
  playerStickering: 'sideEdges',
  standing: ROUX_STANDING,
};

const LAST_EDGES_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'full',
  playerStickering: 'full',
  standing: ROUX_STANDING,
};

/** Turns over the three front edges on top and the front one below. */
const EDGE_FLIP = "M' U M";
/** The top front edge for the bottom front one, neither turned over. */
const FRONT_SWAP = "M' U2 M";
const BACK_SWAP = "M U2 M'";

const JB_PERM = "R U R' F' R U R' U' R' F R2 U' R' U'";

/**
 * Roux in seven steps, the way a first solve goes: two blocks built by feel,
 * the corners with the two algorithms every Roux guide starts on, and the last
 * six edges with nothing but M and U. The corners are cases out of 2-Look
 * CMLL, which is also where the quicker way through them lives.
 *
 * The last three steps are where somebody coming from CFOP gets lost, so they
 * leave nothing to trial and error: each says what to count, and has a picture
 * for every answer with the hold and the moves. Every one of those routes was
 * run over all the states it can be met in before it was written down.
 */
export const ROUX_STEPS: readonly LearnStep[] = [
  {
    id: 'roux-first-block',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    // No situations: the block is built by feel, and two pictures of a pair
    // dropping in read as the two moves to learn.
    situations: [],
    goal: { picture: LEFT_BLOCK_PICTURE, caption: strings.learn.rouxBlockCaption },
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
    setId: ROUX_EO_SET_ID,
    group: ROUX_EO_GROUPS.four,
    caseIds: ['roux-eo-arrow'],
    keyText: strings.learn.rouxSituations.arrow,
    holds: [],
    // The ways to the arrow, by how many edges are bad. Two tools do all of
    // it: the arrow's own three moves, and a swap that turns nothing over.
    situations: [
      {
        alg: FRONT_SWAP,
        next: `U2 ${EDGE_FLIP}`,
        text: strings.learn.rouxSituations.fourOnTop,
      },
      {
        alg: FRONT_SWAP,
        next: "U' M U M'",
        text: strings.learn.rouxSituations.twoAndTwo,
      },
      {
        alg: EDGE_FLIP,
        next: `U2 ${EDGE_FLIP}`,
        text: strings.learn.rouxSituations.twoBad,
      },
      {
        alg: EDGE_FLIP,
        next: `U ${EDGE_FLIP} U2 M U M'`,
        text: strings.learn.rouxSituations.sixBad,
      },
    ],
    picture: EDGE_FLIP_PICTURE,
    markedCorner: null,
    // Every case of edge orientation with an algorithm of its own, for
    // somebody who wants it in one go rather than by way of the arrow.
    advanced: { setId: ROUX_EO_SET_ID, group: null },
    ...strings.learn.rouxSteps.edgeOrientation,
  },
  {
    id: 'roux-side-edges',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    // The step's one algorithm first: both edges at the bottom, facing each
    // other. Then every other place the two can be, each with the whole way
    // into that position — not a hop to the next picture, which leaves the
    // reader stitching three cards together with a cube in both hands.
    situations: [
      { alg: "U M2 U'", text: strings.learn.rouxSituations.sideEdgesDown },
      { alg: 'M2', next: "U M2 U'", text: strings.learn.rouxSituations.sideTopOpposite },
      { alg: BACK_SWAP, next: 'U M2 U', text: strings.learn.rouxSituations.sideOneDown },
      {
        alg: `M2 U ${FRONT_SWAP}`,
        next: "U2 M2 U'",
        text: strings.learn.rouxSituations.sideTopAdjacent,
      },
    ],
    picture: SIDE_EDGES_PICTURE,
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
      { alg: 'U2 M2 U2 M2', text: strings.learn.rouxSituations.dots },
      { alg: "U2 M U2 M'", text: strings.learn.rouxSituations.threeCycle },
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

/** Everything between a picture and the end of its step: the moves shown, then what follows. */
export function wayOut(hold: LearnHold | LearnSituation): string {
  return 'next' in hold && hold.next !== undefined ? `${hold.alg} ${hold.next}` : hold.alg;
}

/** The cube as the reader meets it: stood as the step holds it, then the way out undone. */
export function holdState(hold: LearnHold | LearnSituation, standing = ''): CubeState {
  const turn = parseAlg(standing);
  const stood = turn.ok ? applyAlg(solvedState(), turn.moves) : solvedState();
  const way = parseAlg(wayOut(hold));
  return way.ok ? applyAlg(stood, invertAlg(way.moves)) : stood;
}
