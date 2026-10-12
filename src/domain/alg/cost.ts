/**
 * What an algorithm costs beyond the case it answers.
 *
 * Most F2L algorithms put the pair in and leave everything under the last
 * layer exactly as they found it. Some do not: they are shorter, or they suit
 * the hands better, and they pay for it by taking a slot apart on the way
 * through. That is only a price worth paying while the slot in question has
 * not been built yet, so it is something the reader has to be told rather than
 * left to discover mid-solve.
 */

import { canonicalise } from '../cube/orientation';
import { applyAlg, FACELETS, solvedState, type CubeState } from '../cube/state';
import type { Move } from '../cube/notation';
import { isJudgedAsHeld, type Stickering } from '../cube/views';

const solved = solvedState();
const BELOW_TOP = FACELETS.flatMap((sticker, index) => (sticker.position[1] === 1 ? [] : [index]));

/** The front-right slot: the one every case in this app is solved in. */
const SLOT = FACELETS.flatMap((sticker, index) => {
  const [x, y, z] = sticker.position;
  return x === 1 && z === 1 && y !== 1 ? [index] : [];
});

/** Roux's blocks: everything on the left and the right under the top layer. */
const BLOCKS = FACELETS.flatMap((sticker, index) => {
  const [x, y] = sticker.position;
  return x !== 0 && y !== 1 ? [index] : [];
});

/** The back pair of the right block: the slot a second-block algorithm can cost. */
const BACK_SLOT = new Set(
  FACELETS.flatMap((sticker, index) => {
    const [x, y, z] = sticker.position;
    return x === 1 && z === -1 && y !== 1 ? [index] : [];
  }),
);

const layersStanding = (state: CubeState): boolean =>
  BELOW_TOP.every((index) => state[index] === solved[index]);

const pairHome = (state: CubeState): boolean =>
  SLOT.every((index) => state[index] === solved[index]);

/**
 * Whether this case lives in the layers below the last one, as F2L cases do.
 *
 * Both functions here want the case in the frame its algorithm is written for
 * — the case's own setup, with nothing in front of it. The trainer draws F2L
 * a quarter turn round so the slot has red in front of it, and on that cube
 * every sticker differs from a solved one without a single piece being out of
 * place. Judging a solution there would answer about a different slot.
 */
export function isFirstTwoLayersCase(state: CubeState): boolean {
  return !layersStanding(state);
}

/**
 * Whether performing `moves` on this case puts the pair in and takes a slot
 * apart doing it.
 *
 * Answered by running it rather than by reading it, so it holds for an
 * algorithm the reader typed in as much as for one that shipped with the app.
 *
 * Both halves are required, and the first one is why: an algorithm that simply
 * does not work also leaves the layers in pieces, and calling that "breaks
 * another slot" would be telling the reader the wrong thing about it. This is
 * for the solution that works and charges for it.
 *
 * The cube is stood up before the result is judged, because an algorithm is
 * allowed to turn it and a good many of these do.
 *
 * `stickering` is what the case's set looks at, and it decides what there is
 * to break. Roux's second block has one slot to cost — the back pair — and is
 * judged as the cube lies, since its algorithms are free to leave the middle
 * slice anywhere. The steps after it have none: the pieces they leave out of
 * place under the top layer are the last six edges, which is the job still to
 * do, not a slot taken apart. Without this every such case whose algorithm
 * left the slice where it found it was marked as breaking one.
 */
export function costsASlot(
  state: CubeState,
  moves: readonly Move[],
  stickering: Stickering = 'full',
): boolean {
  if (stickering === 'blocks') {
    const after = applyAlg(state, moves);
    const kept = BLOCKS.filter((index) => !BACK_SLOT.has(index));
    return (
      kept.every((index) => after[index] === solved[index]) &&
      [...BACK_SLOT].some((index) => after[index] !== solved[index])
    );
  }
  if (isJudgedAsHeld(stickering)) return false;
  if (!isFirstTwoLayersCase(state)) return false;

  const after = canonicalise(applyAlg(state, moves));
  return pairHome(after) && !layersStanding(after);
}
