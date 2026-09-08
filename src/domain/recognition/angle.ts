/**
 * The algorithm for the case as it was shown.
 *
 * A recognition question meets the case at a random angle — the drill's own
 * scramble turns the cube and adds a U turn (see domain/drill/scramble.ts) —
 * and an algorithm written for the case straight on does not solve it from
 * there. What is missing is one turn of the top layer in front, which is the
 * same AUF a solver works out for themselves with the cube in their hands.
 *
 * It is found by trying, not by undoing the scramble's own AUF. The algorithm
 * on show is whichever one the case is set to, and a user can type in one that
 * carries its own AUF or starts by rotating the cube; inverting the scramble
 * would be right about the pack and wrong about them. Four candidates over a
 * dozen moves is nothing to run.
 */

import { parseAlg, type Move } from '../cube/notation';
import { applyAlg, isSolvedIgnoringOrientation, type CubeState } from '../cube/state';

/** No turn first, then the three that are. Order decides ties: none wins. */
const AUFS: readonly string[] = ['', 'U', 'U2', "U'"];

const CANDIDATES: readonly Move[][] = AUFS.map((text) => {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`AUF does not parse: ${text}`);
  return parsed.moves;
});

/**
 * The turn to put in front of the algorithm so it solves the cube as drawn.
 * An empty list means it already does; null means no AUF makes it solve, which
 * is what an algorithm that does not belong to this case looks like.
 */
export function aufForAngle(state: CubeState, algMoves: readonly Move[]): Move[] | null {
  if (algMoves.length === 0) return null;

  for (const auf of CANDIDATES) {
    if (isSolvedIgnoringOrientation(applyAlg(applyAlg(state, auf), algMoves))) return [...auf];
  }
  return null;
}
