/**
 * Whether an algorithm solves a case: the check one the reader typed in has to
 * pass before the trainer keeps it.
 *
 * "Solves" is meant the way the step means it. A first look at OLL only has to
 * orient the edges, and whatever it does to the corners is the second look's
 * business; a first look at PLL only has to put the corners home. So each set
 * says what it has to leave right (`goalOf`), and an algorithm that leaves
 * that right — and the two layers under it outright — solves the case, however
 * it leaves the rest.
 *
 * The same judge the drill uses on a case (recognition/angle.ts): a cube left
 * solved outright passes whatever the step, and so does one left right as far
 * as the step looks. An F2L algorithm that puts the pair in by taking another
 * slot apart passes too — the packs offer those, and the case sheet says what
 * they cost — but not one that takes the cross apart: that is not a price
 * anybody pays for a pair.
 *
 * Tried from every angle of the top layer, because a published algorithm is
 * as often written for the case turned a quarter as for the case as drawn. The
 * turn that works is handed back, so whatever shows the algorithm can say
 * which way to hold the case first. A turn of the top layer at the end is
 * allowed too: it is the one a solver makes anyway.
 */

import { canonicalise } from '../cube/orientation';
import { parseAlg, type Move } from '../cube/notation';
import { FACELETS, applyAlg, isSolvedIgnoringOrientation, solvedState, type CubeState } from '../cube/state';
import { isJudgedAsHeld, isSolvedAsShown, type Stickering } from '../cube/views';
import { costsASlot } from './cost';
import { TWO_LOOK_CMLL_GROUPS } from './sets';

/** What a step has to leave right: every one of these has to read solved. */
export type CaseGoal = readonly Stickering[];

/** Shortest first: none, a quarter either way, then a half. Order decides ties. */
const AUFS = ['', 'U', "U'", 'U2'] as const;
export type Auf = (typeof AUFS)[number];

const AUF_MOVES: readonly (readonly Move[])[] = AUFS.map((text) => {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`AUF does not parse: ${text}`);
  return parsed.moves;
});

const SOLVED = solvedState();

/** The stickers of the cross's four edges. */
const CROSS = FACELETS.flatMap((sticker, index) => {
  const [x, y, z] = sticker.position;
  return y === -1 && (x === 0) !== (z === 0) ? [index] : [];
});

const isCrossStanding = (state: CubeState): boolean =>
  CROSS.every((index) => state[index] === SOLVED[index]);

export type AlgVerdict =
  | { ok: true; preAuf: Auf }
  | { ok: false; error: 'unreadable' | 'unsolved' };

/**
 * What a case in this set has to be left as, or null where the trainer has no
 * rule for it yet — an algorithm there is kept on the reader's word, as every
 * one was before this check existed.
 */
export function goalOf(setId: string, group: string | null): CaseGoal | null {
  const isEdges = group?.includes('Edges') === true;
  switch (setId) {
    case 'oll':
      return ['orientation'];
    case 'pll':
      return ['full'];
    case '2look-oll':
      return isEdges ? ['edgeOrientation'] : ['orientation'];
    case '2look-pll':
      // The corners look is read by the corners alone, but it may not undo
      // the orientation OLL left: a flipped edge is not something PLL fixes.
      return isEdges ? ['full'] : ['orientation', 'corners'];
    case 'f2l':
    case 'f2l-advanced':
    case 'f2l-expert':
      return ['firstTwoLayers'];
    // Roux, judged as its steps leave the cube: the blocks kept, and the six
    // edges and the middle slice free until the last step.
    case 'roux-sb':
      return ['blocks'];
    case 'cmll':
      return ['blocksAndCorners'];
    case '2look-cmll':
      // The second look is drawn by its corners, but it is done only when
      // they are home against the blocks, which is what CMLL asks for.
      return group === TWO_LOOK_CMLL_GROUPS.orientation ? ['cornerOrientation'] : ['blocksAndCorners'];
    case 'roux-eo':
      return ['lseOrientation'];
    case 'roux-eolr':
      return ['eolr'];
    default:
      return null;
  }
}

export function verifyAlg(state: CubeState, alg: string, goal: CaseGoal): AlgVerdict {
  const parsed = parseAlg(alg);
  if (!parsed.ok || parsed.moves.length === 0) return { ok: false, error: 'unreadable' };

  // Stood up by its centres, as an algorithm may end with the cube rotated —
  // except where the step may leave the middle slice turned, which moves the
  // centres the standing goes by.
  const standUp = goal.some(isJudgedAsHeld) ? (turned: CubeState) => turned : canonicalise;
  const slot = goal[0] ?? 'full';

  for (const [index, auf] of AUF_MOVES.entries()) {
    const moves = [...auf, ...parsed.moves];
    const after = applyAlg(state, moves);
    const upright = standUp(after);
    const isSolved =
      isSolvedIgnoringOrientation(after) ||
      AUF_MOVES.some((end) => {
        const finished = applyAlg(upright, end);
        return goal.every((stickering) => isSolvedAsShown(finished, stickering));
      }) ||
      (costsASlot(state, moves, slot) && (slot === 'blocks' || isCrossStanding(upright)));
    if (isSolved) return { ok: true, preAuf: AUFS[index] ?? '' };
  }
  return { ok: false, error: 'unsolved' };
}

const QUARTERS: Readonly<Record<string, number>> = { U: 1, U2: 2, "U2'": 2, "U'": 3 };
const TURNS: readonly Auf[] = ['', 'U', 'U2', "U'"];
/** A turn of the top layer the algorithm opens with, inside a bracket or not. */
const OPENING_TURN = /^([([]?\s*)(U2'|U2|U'|U)(?=[\s)\]]|$)/;

/**
 * The algorithm as it is performed from the case as drawn: with the turn it
 * wants first written in front of it, the way the packs write theirs. One
 * spelling everywhere — the list, the moving cube, the drill and the printed
 * sheet all perform what is written, and a turn kept aside would have to be
 * remembered by each of them.
 *
 * Merged with a turn the algorithm already opens with, rather than written
 * beside it: `U U' R …` is a turn nobody makes.
 */
export function withPreAuf(alg: string, auf: Auf): string {
  const text = alg.replace(/[’‘`´]/g, "'").trim();
  if (auf === '') return text;
  const opening = OPENING_TURN.exec(text);
  if (!opening) return `${auf} ${text}`;

  const quarters = (QUARTERS[auf] ?? 0) + (QUARTERS[opening[2] ?? ''] ?? 0);
  const turn = TURNS[quarters % 4] ?? '';
  return `${opening[1] ?? ''}${turn} ${text.slice(opening[0].length)}`
    .replace(/[([]\s*[)\]]/g, '')
    .replace(/([([])\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
