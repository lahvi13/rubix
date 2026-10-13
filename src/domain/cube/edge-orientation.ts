/**
 * Edge orientation as ZZ reads it: against the cube's front-back axis.
 *
 * An edge is good when turns of R, L, U and D can take it home, and bad when
 * it needs a quarter turn of F or B — those are the only turns that carry a
 * sticker between the two sets of places an edge sticker can be in. One set
 * is the top and bottom faces and the middle row of the front and back; the
 * other is everything else. Each edge has one sticker that belongs in the
 * first set: its top or bottom colour, or, for the four edges with neither,
 * its front or back colour. The edge is good exactly when that sticker is
 * there.
 *
 * The first set is called the inner places here.
 *
 * Which edges are bad depends on how the cube is held — a quarter turn about
 * the vertical axis changes the answer — so the cube is read as it lies, its
 * colours against its own centres.
 */

import { FACES, type Face } from './notation';
import { FACELETS, type CubeState } from './state';

/** The other sticker of the edge a sticker belongs to; -1 for a corner or a centre. */
const PARTNER: readonly number[] = FACELETS.map((sticker, index) => {
  const others = FACELETS.flatMap((candidate, at) =>
    at !== index && candidate.position.every((value, axis) => value === sticker.position[axis])
      ? [at]
      : [],
  );
  return others.length === 1 ? (others[0] ?? -1) : -1;
});

const CENTRES: readonly (readonly [Face, number])[] = FACES.map((face) => [
  face,
  FACELETS.findIndex((sticker) => sticker.face === face && sticker.row === 1 && sticker.column === 1),
]);

/** The face a colour belongs to on the cube as it lies. */
function homeOf(state: CubeState, colour: Face | undefined): Face | undefined {
  return CENTRES.find(([, centre]) => state[centre] === colour)?.[0];
}

const isPole = (face: Face | undefined): boolean => face === 'U' || face === 'D';
const isFrontOrBack = (face: Face | undefined): boolean => face === 'F' || face === 'B';

/**
 * Whether an edge sticker's place is an inner one: on the top or bottom face,
 * or in the middle row of the front or back. False for the other twelve, and
 * for every corner and centre.
 */
export function isInnerPlace(index: number): boolean {
  const place = FACELETS[index];
  if (place === undefined || (PARTNER[index] ?? -1) < 0) return false;
  return isPole(place.face) || (isFrontOrBack(place.face) && place.position[1] === 0);
}

/** The other sticker of the edge a sticker belongs to; -1 for a corner or a centre. */
export function partnerOf(index: number): number {
  return PARTNER[index] ?? -1;
}

/**
 * Whether the sticker in an inner place leaves its edge undecided. A top or
 * bottom colour there is a good edge and a left or right one a bad edge, at a
 * glance; a front or back colour is right on an edge with no top or bottom
 * colour and wrong on one that has it, so the other sticker has the say.
 */
export function isSettledByPartner(state: CubeState, index: number): boolean {
  return isInnerPlace(index) && isFrontOrBack(homeOf(state, state[index]));
}

/** Whether the sticker at `index` is on a bad edge. Never true of a corner or a centre. */
export function isBadEdge(state: CubeState, index: number): boolean {
  const partner = PARTNER[index] ?? -1;
  if (partner < 0) return false;

  const stickers = [index, partner];
  const homes = stickers.map((sticker) => homeOf(state, state[sticker]));
  const pole = homes.findIndex(isPole);
  const key = stickers[pole >= 0 ? pole : homes.findIndex(isFrontOrBack)];
  return key !== undefined && !isInnerPlace(key);
}

/** How many edges are bad: always even, from none to twelve. */
export function badEdgeCount(state: CubeState): number {
  // Every bad edge is met twice, once for each of its stickers.
  return FACELETS.filter((_, index) => isBadEdge(state, index)).length / 2;
}
