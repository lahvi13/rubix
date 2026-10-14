import type { DiagramView, MarkedCorner } from '../../components/CubeDiagram';
import {
  BEGINNER_GROUPS,
  BEGINNER_SET_ID,
  CROSS_SET_ID,
  POCKET_OLL_SET_ID,
  POCKET_PBL_SET_ID,
  ROUX_EO_GROUPS,
  ROUX_EO_SET_ID,
  TWO_LOOK_CMLL_GROUPS,
  TWO_LOOK_CMLL_SET_ID,
} from '../../domain/alg/sets';
import { invertAlg, parseAlg } from '../../domain/cube/notation';
import { applyAlg, solvedState, type CubeState } from '../../domain/cube/state';
import type { Stickering } from '../../domain/cube/views';
import type { SupportedPuzzle } from '../../domain/puzzle/puzzles';
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
  /**
   * What the card prints instead of `alg`, where `alg` is one short sequence
   * run several times and the card's own line says how many: the sequence
   * once reads at a glance, five of it in a column is a wall.
   */
  shown?: string;
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

/**
 * A cube drawn to show a rule rather than a position to get out of: the
 * example a step asks the reader to try, and its answer.
 */
export interface LearnFigure {
  picture: SituationPicture;
  /** The moves that make the cube drawn, from a solved one stood as the picture stands. */
  setup: string;
  caption: string;
  /** Printed under the picture, for a reader following along with a cube in hand. */
  isSetupShown: boolean;
}

/**
 * A rule drawn as the thing to look for. Its text is the rule itself, so it
 * stays when the explanations are folded away: like how to hold the cube for
 * a repeat, it is the page as a cheat sheet.
 */
export interface LearnRule {
  view: DiagramView;
  stickering: Stickering;
  standing: string;
  text: string;
}

/**
 * Situations kept behind a button: the long way round, for a step whose first
 * pictures are all most readers need.
 */
export interface LearnMore {
  situations: readonly LearnSituation[];
  /** What the pictures are and the order they are walked in. */
  lead: string;
  show: string;
  hide: string;
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
  /** What to look for, drawn, for a step that teaches a rule and no moves. */
  rules?: readonly LearnRule[];
  /** A cube to try the rules on, and its answer. */
  figures?: readonly LearnFigure[];
  /** Further situations, behind a button of their own. */
  more?: LearnMore;
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
const CORNER_ORIENTATION_STEP: LearnStep = {
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
};

const CORNER_PERMUTATION_STEP: LearnStep = {
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
};

const EDGE_PERMUTATION_STEP: LearnStep = {
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
};

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
  CORNER_ORIENTATION_STEP,
  CORNER_PERMUTATION_STEP,
  EDGE_PERMUTATION_STEP,
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
    // other. Drawn twice, once for each colour in front, because the top
    // turns the other way and one picture alone reads as three fixed moves.
    // Then every other place the two can be, each with the whole way
    // into that position — not a hop to the next picture, which leaves the
    // reader stitching three cards together with a cube in both hands.
    situations: [
      { alg: "U M2 U'", text: strings.learn.rouxSituations.sideEdgesDown },
      { alg: "U' M2 U", text: strings.learn.rouxSituations.sideEdgesDownMirror },
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

/**
 * ZZ, held the way its tutorial holds it: yellow up and blue in front, a half
 * turn from how every skin is written. Not the quarter turn the F2L pictures
 * use to keep green and orange apart: which edges are bad is read against the
 * front and the back, and a quarter turn round is another cube. A half turn
 * does that job as well — the front right slot is blue beside red.
 */
const ZZ_STANDING = 'y2';

const ALL_EDGES_NET: SituationPicture = {
  view: 'net',
  stickering: 'allEdges',
  playerStickering: 'allEdges',
  standing: ZZ_STANDING,
};

const BAD_EDGES_NET: SituationPicture = { ...ALL_EDGES_NET, stickering: 'badEdges' };

/**
 * Where the bad edges are, from the corner the cube is turned from. The cube
 * that plays the moves wears its edges' colours instead of the flags: an edge
 * going good is its colours changing places, and a flag cannot show that.
 */
const BAD_EDGES_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'badEdges',
  playerStickering: 'allEdges',
  standing: ZZ_STANDING,
};

const ZZ_CROSS_PICTURE: SituationPicture = { ...CROSS_PICTURE, standing: ZZ_STANDING };

const ZZ_PAIR_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'firstTwoLayers',
  playerStickering: 'firstTwoLayers',
  standing: ZZ_STANDING,
};

/** Seven turns from solved that leave six edges bad, two of them in each layer. */
const BAD_EDGES_EXAMPLE = "F' L' D U2 L B' D";

/**
 * ZZ in seven steps. The first two are the method: which edges are bad, and
 * how to turn them good — a count and a picture for every answer, like Roux's
 * last three, because that is where somebody coming from CFOP has nothing to
 * go by. The cross and the pairs are CFOP's with fewer turns allowed, and the
 * last layer is CFOP's own last three steps, minus the one the edges already
 * did.
 *
 * The pairs open on the two shapes a pair goes in from. The way to them is a
 * procedure — both pieces up, apart, then by the colour on top of the corner
 * — and as it is worded it was run over every place a pair can be, for each
 * of the four slots, before it was written down.
 */
export const ZZ_STEPS: readonly LearnStep[] = [
  {
    id: 'zz-bad-edges',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [],
    // One sticker to an edge, and the three kinds of colour it can show: a
    // picture each, with the reason beside the verdict — a verdict alone left
    // the reader asking good against what. The first says where to look, by
    // face, since a picture shows three of the six. The first version drew
    // two sets of places a colour must not be in, and every edge had to be
    // held against both.
    rules: [
      {
        view: 'isometric',
        stickering: 'readsPole',
        standing: ZZ_STANDING,
        text: strings.learn.zzRules.readsPole,
      },
      {
        view: 'isometric',
        stickering: 'readsSide',
        standing: ZZ_STANDING,
        text: strings.learn.zzRules.readsSide,
      },
      {
        view: 'isometric',
        stickering: 'readsFront',
        standing: ZZ_STANDING,
        text: strings.learn.zzRules.readsFront,
      },
    ],
    // The same cube twice: to count on, and with the answer. A third between
    // them once showed only the stickers read; it was there to explain what
    // the pictures did not, and with their reasons written out it was one
    // unfolded cube too many.
    figures: [
      {
        picture: ALL_EDGES_NET,
        setup: BAD_EDGES_EXAMPLE,
        caption: strings.learn.zzFigures.tryIt,
        isSetupShown: true,
      },
      {
        picture: BAD_EDGES_NET,
        setup: BAD_EDGES_EXAMPLE,
        caption: strings.learn.zzFigures.answer,
        isSetupShown: false,
      },
    ],
    markedCorner: null,
    advanced: null,
    ...strings.learn.zzSteps.badEdges,
  },
  {
    id: 'zz-edges-good',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    // The turn itself, the two ways of carrying an edge to it — by the face
    // it lies on, and round a place that is taken — and the two counts that
    // do not divide by four. Run as worded over all 2,048 layouts of bad
    // edges, with the half turn of the back the tip keeps for the rest.
    situations: [
      { alg: 'F', text: strings.learn.zzSituations.fourOnFront },
      { alg: "R' F", text: strings.learn.zzSituations.gather },
      { alg: "R' U R F", text: strings.learn.zzSituations.aside },
      { alg: 'F', next: "R' F", text: strings.learn.zzSituations.twoBad },
      { alg: 'F', next: "R' L U2 F", text: strings.learn.zzSituations.sixBad },
    ],
    picture: BAD_EDGES_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.zzSteps.edgesGood,
  },
  {
    id: 'zz-cross',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [
      { alg: 'F2', text: strings.learn.zzSituations.crossTop },
      { alg: "D R' D'", text: strings.learn.zzSituations.crossMiddle },
    ],
    picture: ZZ_CROSS_PICTURE,
    goal: {
      picture: { ...ZZ_CROSS_PICTURE, view: 'net' },
      caption: strings.learn.crossCaption,
    },
    markedCorner: null,
    advanced: null,
    ...strings.learn.zzSteps.cross,
  },
  {
    id: 'zz-pairs',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    // The two shapes a pair goes in from. Whoever gets this far knows F2L, and
    // those two with the rule about what may turn are most of what is new.
    situations: [
      { alg: "R U' R'", text: strings.learn.zzSituations.joined },
      { alg: "R U R'", text: strings.learn.zzSituations.split },
    ],
    // The way to them, in the order it is walked: a piece out of a slot, the
    // two apart, and the three colours the top of the corner can be. Behind a
    // button — seven cards at once read as seven things to learn.
    more: {
      situations: [
        { alg: "R U R'", next: "U' R U R'", text: strings.learn.zzSituations.stuck },
        { alg: "R U2 R'", next: "U' R U R'", text: strings.learn.zzSituations.touching },
        { alg: "R U2 R'", next: "U R U' R'", text: strings.learn.zzSituations.whiteUp },
        { alg: "R U2 R'", next: "U' R U2 R'", text: strings.learn.zzSituations.topsMatch },
        { alg: "R U R'", next: "U R U R'", text: strings.learn.zzSituations.topsDiffer },
      ],
      ...strings.learn.zzPairsMore,
    },
    picture: ZZ_PAIR_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.zzSteps.pairs,
  },
  // The last layer is CFOP's, cases and pictures and all — only the reason
  // its cross is already there is ZZ's own.
  {
    ...CORNER_ORIENTATION_STEP,
    id: 'zz-corner-orientation',
    ...strings.learn.zzSteps.cornersUp,
  },
  { ...CORNER_PERMUTATION_STEP, id: 'zz-corner-permutation' },
  { ...EDGE_PERMUTATION_STEP, id: 'zz-edge-permutation' },
];

/** The four moves J Perm's 2×2 method is made of. */
export const FOUR_MOVES = "R U R' U'";

function fourMoves(times: number): string {
  return Array.from({ length: times }, () => FOUR_MOVES).join(' ');
}

/**
 * Three of the top's four pieces round in a ring, the one at the front right
 * left where it is — the one algorithm of the method's second step.
 */
export const PLACE_PIECES = "U R U' L' U R' U' L";

/** Turns the two pieces on the right of the top where they stand, and nothing else. */
const TURNED_IN_PLACE = "R U2 R' U' R U' R' L' U2 L U L' U L";
/** Swaps those same two, each keeping its yellow on top. */
const SWAPPED = "R U R' U' R' F R2 U' R' U' R U R' F'";

/** The white pieces in colour wherever they are; the yellow ones do not matter yet. */
const WHITE_LAYER_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'bottomLayer',
  playerStickering: 'bottomLayer',
  standing: '',
};

const WHOLE_CUBE_PICTURE: SituationPicture = {
  view: 'isometric',
  stickering: 'full',
  playerStickering: 'full',
  standing: '',
};

/** The cube turned over for the last step: white on top, the same side in front. */
const TURNED_OVER_PICTURE: SituationPicture = { ...WHOLE_CUBE_PICTURE, standing: 'z2' };

/**
 * The 2×2 for a first solve, as J Perm teaches it (jperm.net/2x2): a layer
 * with four moves, the top's pieces to their places with one algorithm, and
 * the same four moves again to turn them. The numbers on the cards — how many
 * rounds of the four moves from which way the sticker faces — were read off
 * the model, and the tests run every step as it is worded over every state it
 * can be met in.
 *
 * The cube is the model's corners, so every picture is drawn with `order: 2`
 * (`PUZZLE_GUIDES` says which cube a guide is for).
 */
export const POCKET_STEPS: readonly LearnStep[] = [
  {
    id: 'pocket-white-layer',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [
      { alg: fourMoves(1), text: strings.learn.pocket.situations.whiteRight },
      { alg: fourMoves(3), shown: FOUR_MOVES, text: strings.learn.pocket.situations.whiteUp },
      { alg: fourMoves(5), shown: FOUR_MOVES, text: strings.learn.pocket.situations.whiteFront },
    ],
    picture: WHITE_LAYER_PICTURE,
    goal: { picture: WHITE_LAYER_PICTURE, caption: strings.learn.pocket.goal },
    markedCorner: null,
    advanced: null,
    ...strings.learn.pocket.steps.whiteLayer,
  },
  {
    id: 'pocket-place',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    // The rule drawn twice, at the corner the cube is looked at from: a piece
    // that is home though turned, and one that is not.
    figures: [
      {
        picture: WHOLE_CUBE_PICTURE,
        setup: TURNED_IN_PLACE,
        caption: strings.learn.pocket.figures.inPlace,
        isSetupShown: false,
      },
      {
        picture: WHOLE_CUBE_PICTURE,
        setup: SWAPPED,
        caption: strings.learn.pocket.figures.notInPlace,
        isSetupShown: false,
      },
    ],
    situations: [{ alg: PLACE_PIECES, text: strings.learn.pocket.situations.oneInPlace }],
    picture: WHOLE_CUBE_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.pocket.steps.place,
  },
  {
    id: 'pocket-turn',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    // Each drawn as the first piece of the step is met: one more piece still
    // to turn after it, so the white layer on top is whole — it only comes
    // apart once the four moves have started.
    situations: [
      {
        alg: fourMoves(2),
        next: `D ${fourMoves(4)} D'`,
        shown: FOUR_MOVES,
        text: strings.learn.pocket.situations.yellowRight,
      },
      {
        alg: fourMoves(4),
        next: `D ${fourMoves(2)} D'`,
        shown: FOUR_MOVES,
        text: strings.learn.pocket.situations.yellowFront,
      },
    ],
    picture: TURNED_OVER_PICTURE,
    markedCorner: null,
    advanced: null,
    ...strings.learn.pocket.steps.turn,
  },
];

export const POCKET_LAYERS_GUIDE_ID = '222-layers';
export const POCKET_ORTEGA_GUIDE_ID = '222-ortega';

/** A face with its sides wrong: the bottom's pieces swapped across, both faces whole. */
const FACE_NOT_LAYER = 'R2 F2 R2';

/**
 * Ortega, as J Perm teaches it (jperm.net/2x2/faster): a face, then the
 * opposite face with one of seven algorithms, then both layers with one of
 * five. The face is built by feel — J Perm has no algorithm for it — so it is
 * shown finished; the two sets are cases out of the trainer, each drawn and
 * opened there as here.
 */
export const ORTEGA_STEPS: readonly LearnStep[] = [
  {
    id: 'ortega-face',
    setId: null,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [],
    // Unfolded, with only the face's colour in it: what makes it a face and
    // not a layer is the sides, and no corner shows all four.
    figures: [
      {
        picture: { view: 'net', stickering: 'bottomLayer', playerStickering: 'bottomLayer', standing: '' },
        setup: FACE_NOT_LAYER,
        caption: strings.learn.ortega.faceCaption,
        isSetupShown: false,
      },
    ],
    markedCorner: null,
    advanced: null,
    ...strings.learn.ortega.steps.face,
  },
  {
    id: 'ortega-oll',
    setId: POCKET_OLL_SET_ID,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [],
    markedCorner: null,
    advanced: null,
    ...strings.learn.ortega.steps.oll,
  },
  {
    id: 'ortega-pbl',
    setId: POCKET_PBL_SET_ID,
    group: null,
    caseIds: [],
    keyText: null,
    holds: [],
    situations: [],
    markedCorner: null,
    advanced: null,
    ...strings.learn.ortega.steps.pbl,
  },
];

/** A guide per method, by the method's id — or by an id of its own where it is no method. */
export const GUIDES: Readonly<Record<string, readonly LearnStep[]>> = {
  cfop: LEARN_STEPS,
  roux: ROUX_STEPS,
  zz: ZZ_STEPS,
  [POCKET_LAYERS_GUIDE_ID]: POCKET_STEPS,
  [POCKET_ORTEGA_GUIDE_ID]: ORTEGA_STEPS,
};

/** The guides of each cube, in the order their switch offers them. */
export const PUZZLE_GUIDES: Readonly<Record<SupportedPuzzle, readonly string[]>> = {
  '333': ['cfop', 'roux', 'zz'],
  '222': [POCKET_LAYERS_GUIDE_ID, POCKET_ORTEGA_GUIDE_ID],
};

/** Every situation of a step, the ones behind its button included. */
export function allSituations(step: LearnStep): readonly LearnSituation[] {
  return [...step.situations, ...(step.more?.situations ?? [])];
}

/** How a step's situations are drawn: its own picture, or the cross's. */
export function situationPicture(step: LearnStep): SituationPicture {
  return step.picture ?? CROSS_PICTURE;
}

/** Everything between a picture and the end of its step: the moves shown, then what follows. */
export function wayOut(hold: LearnHold | LearnSituation): string {
  return 'next' in hold && hold.next !== undefined ? `${hold.alg} ${hold.next}` : hold.alg;
}

/** The cube a figure draws: stood as its picture stands, then its moves done. */
export function figureState(figure: LearnFigure): CubeState {
  const moves = parseAlg(`${figure.picture.standing} ${figure.setup}`);
  return moves.ok ? applyAlg(solvedState(), moves.moves) : solvedState();
}

/** The cube as the reader meets it: stood as the step holds it, then the way out undone. */
export function holdState(hold: LearnHold | LearnSituation, standing = ''): CubeState {
  const turn = parseAlg(standing);
  const stood = turn.ok ? applyAlg(solvedState(), turn.moves) : solvedState();
  const way = parseAlg(wayOut(hold));
  return way.ok ? applyAlg(stood, invertAlg(way.moves)) : stood;
}
