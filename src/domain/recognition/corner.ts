/**
 * Looking at the cube from the other side.
 *
 * A recognition question shows the two faces you can actually see with the
 * cube in your hands — the top, the front and the right — and that is
 * sometimes not enough to say which case it is. It is not enough at the table
 * either, and what people do there is turn the cube round, so that is what
 * this is: the same cube, met from the back-left corner.
 */

import { parseAlg } from '../cube/notation';
import { applyAlg, type CubeState } from '../cube/state';

/** Turning the cube, not solving it: the case is untouched, the view is not. */
const HALF_TURN = parseAlg('y2');

export function fromOtherCorner(state: CubeState): CubeState {
  if (!HALF_TURN.ok) throw new Error('y2 does not parse');
  return applyAlg(state, HALF_TURN.moves);
}
