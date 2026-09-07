/**
 * A stickering handed to the player ready-made.
 *
 * cubing.js hangs its own stickerings off the U layer: "F2L" greys the pieces
 * that a U turn moves, because in its frame the last layer is the white one
 * and it is on top. Ours is yellow, and the cube is stood on its head to say
 * so (`CUBE_ORIENTATION`), which puts the last layer exactly where cubing.js
 * keeps the cross — asking it for "F2L" greys the wrong half of the cube.
 *
 * So the mask is worked out here: grey the pieces that one turn of the named
 * face moves, and leave the rest in their colours.
 */

/** As much of cubing.js's stickering mask as we ever set. */
export interface StickeringMask {
  orbits: Record<string, { pieces: { facelets: string[] }[] }>;
}

/** Which layer goes quiet, named by the face that turns it. */
export type Layer = 'U' | 'D';

export async function maskHidingLayer(layer: Layer): Promise<StickeringMask> {
  const { cube3x3x3 } = await import('cubing/puzzles');
  const kpuzzle = await cube3x3x3.kpuzzle();
  // A layer is the set of pieces one turn of it moves — the same way cubing.js
  // works out its own layers, and the only definition that needs no tables.
  const turn = kpuzzle.algToTransformation(layer).transformationData;

  const orbits: StickeringMask['orbits'] = {};
  for (const orbit of kpuzzle.definition.orbits) {
    const moved = turn[orbit.orbitName];

    orbits[orbit.orbitName] = {
      pieces: Array.from({ length: orbit.numPieces }, (_, piece) => {
        const isInLayer =
          moved !== undefined &&
          (moved.permutation[piece] !== piece || moved.orientationDelta[piece] !== 0);
        const facelet = isInLayer ? 'ignored' : 'regular';
        return { facelets: Array.from({ length: orbit.numOrientations }, () => facelet) };
      }),
    };
  }

  return { orbits };
}
