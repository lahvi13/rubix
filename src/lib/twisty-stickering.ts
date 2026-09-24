/**
 * A stickering handed to the player ready-made.
 *
 * cubing.js hangs its own stickerings off the U layer: "F2L" greys the pieces
 * that a U turn moves, because in its frame the last layer is the white one
 * and it is on top. Ours is yellow, and the cube is stood on its head to say
 * so (`CUBE_ORIENTATION`), which puts the last layer exactly where cubing.js
 * keeps the cross — asking it for "F2L" greys the wrong half of the cube.
 *
 * So the mask is worked out here, from the pieces that one turn of the named
 * face moves.
 */

/** As much of cubing.js's stickering mask as we ever set. */
export interface StickeringMask {
  orbits: Record<string, { pieces: { facelets: string[] }[] }>;
}

/** Which layer the mask is about, named by the face that turns it. */
export type Layer = 'U' | 'D';

/** The layer grey, the rest of the cube in its colours. */
export function maskHidingLayer(layer: Layer): Promise<StickeringMask> {
  return maskByLayer(layer, () => 'ignored');
}

/**
 * The layer's own face colour and nothing else of it: the stickers of the
 * layer that are not that colour go grey, and the rest of the cube stays as
 * it is. An OLL case is only about which stickers face up.
 */
export function maskOrientingLayer(layer: Layer): Promise<StickeringMask> {
  // cubing.js counts a piece's stickers from the one that faces U or D when
  // the piece is oriented, so a layer piece's own colour is its first sticker.
  return maskByLayer(layer, (facelet) => (facelet === 0 ? 'regular' : 'ignored'));
}

async function maskByLayer(
  layer: Layer,
  inLayer: (facelet: number) => 'regular' | 'ignored',
): Promise<StickeringMask> {
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
        return {
          facelets: Array.from({ length: orbit.numOrientations }, (_, facelet) =>
            isInLayer ? inLayer(facelet) : 'regular',
          ),
        };
      }),
    };
  }

  return { orbits };
}
