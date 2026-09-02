/**
 * Whole-cube rotations. Published algorithms are written for a grip, not for a
 * fixed frame: `x R' U R' D2 R U' R' D2 R2` leaves the cube lying differently
 * than it started. A diagram has to undo that, or every rotation-using case
 * would be drawn from the wrong side.
 */

import { parseAlg, type Move } from './notation';
import { applyAlg, type CubeState } from './state';

const ROTATION_TEXTS = [
  '',
  'x',
  'x2',
  "x'",
  'z',
  "z'",
  'y',
  'x y',
  'x2 y',
  "x' y",
  'z y',
  "z' y",
  'y2',
  'x y2',
  'x2 y2',
  "x' y2",
  'z y2',
  "z' y2",
  "y'",
  "x y'",
  "x2 y'",
  "x' y'",
  "z y'",
  "z' y'",
] as const;

function parseRotation(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`Bad rotation: ${text}`);
  return parsed.moves;
}

/** All 24 ways a cube can sit on the table. */
export const CUBE_ROTATIONS: readonly Move[][] = ROTATION_TEXTS.map(parseRotation);

/**
 * Turns the cube back so U is on top and F is at the front, judged by the
 * centres — they are the only pieces a rotation cannot lie about.
 */
export function canonicalise(state: CubeState): CubeState {
  for (const rotation of CUBE_ROTATIONS) {
    const rotated = applyAlg(state, rotation);
    if (centreOf(rotated, 'U') === 'U' && centreOf(rotated, 'F') === 'F') return rotated;
  }
  throw new Error('Cube state has no valid orientation');
}

function centreOf(state: CubeState, face: 'U' | 'F'): string | undefined {
  // Centres sit at index 4 of each face block; U is the first block, F the fifth
  // (see FACELETS order in state.ts).
  return face === 'U' ? state[4] : state[4 + 9 * 4];
}
