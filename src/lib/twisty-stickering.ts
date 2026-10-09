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

/** How one sticker is drawn: in its colour, or in the muted grey. */
type Paint = 'regular' | 'ignored';

/** Where a sticker is, as much as a mask needs to decide how to draw it. */
interface StickerAt {
  orbit: string;
  isInLayer: boolean;
  /** Which of the piece's stickers, counted from the one facing U or D. */
  facelet: number;
}

/** The layer grey, the rest of the cube in its colours. */
export function maskHidingLayer(layer: Layer): Promise<StickeringMask> {
  return maskByLayer(layer, ({ isInLayer }) => (isInLayer ? 'ignored' : 'regular'));
}

/**
 * The layer's own face colour and nothing else of it: the stickers of the
 * layer that are not that colour go grey, and the rest of the cube stays as
 * it is. An OLL case is only about which stickers face up. Given a kind, only
 * that kind keeps its colour — the first look at OLL is about the edges, and
 * the corners' yellow there is noise.
 */
export function maskOrientingLayer(layer: Layer, only?: 'EDGES'): Promise<StickeringMask> {
  // cubing.js counts a piece's stickers from the one that faces U or D when
  // the piece is oriented, so a layer piece's own colour is its first sticker.
  return maskByLayer(layer, ({ orbit, isInLayer, facelet }) => {
    if (!isInLayer) return 'regular';
    if (only !== undefined && orbit !== only && orbit !== 'CENTERS') return 'ignored';
    return facelet === 0 ? 'regular' : 'ignored';
  });
}

/**
 * The layer and the centres in colour, everything else grey: the layer being
 * built and the one piece going into it, wherever that piece has got to —
 * the mask follows a piece, not a place. Nothing above the layer is built yet,
 * and a middle-layer edge drawn in colour asks to be looked at for no reason.
 * Given a kind, only that kind of the layer's pieces: the cross is its edges.
 */
export function maskKeepingLayer(layer: Layer, only?: 'EDGES'): Promise<StickeringMask> {
  return maskByLayer(layer, ({ orbit, isInLayer }) =>
    (isInLayer && (only === undefined || orbit === only)) || orbit === 'CENTERS'
      ? 'regular'
      : 'ignored',
  );
}

/**
 * One kind of the layer's pieces grey and the rest of the cube as it is: a
 * step that moves only the corners of the last layer has its edges go quiet,
 * and the other way round.
 */
export function maskHidingLayerPieces(
  layer: Layer,
  kind: 'CORNERS' | 'EDGES',
): Promise<StickeringMask> {
  return maskByLayer(layer, ({ orbit, isInLayer }) =>
    isInLayer && orbit === kind ? 'ignored' : 'regular',
  );
}

/** A face of the cube as it is shown: up is up, left is the viewer's left. */
export type ShownFace = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';

/** Where a sticker's piece lives once the cube stands as shown, and which of its stickers it is. */
interface StickerHome {
  orbit: string;
  /** The faces of the place the piece belongs in, on the cube as it is shown. */
  home: ReadonlySet<ShownFace>;
  /** Which of the piece's stickers, counted from the one facing U or D. */
  facelet: number;
}

/**
 * A mask decided by where each piece belongs on the cube as shown: after the
 * cube has been stood yellow up and turned the way the case is held
 * (`standing`). The layer masks above can name cubing.js's own layers, since
 * every rotation they meet is about the vertical axis; a block on the left
 * cannot, because a quarter turn about that axis is what decides which side
 * is the left.
 */
export async function maskByHome(
  standing: string,
  paint: (sticker: StickerHome) => Paint,
): Promise<StickeringMask> {
  const { cube3x3x3 } = await import('cubing/puzzles');
  const kpuzzle = await cube3x3x3.kpuzzle();
  const stood = kpuzzle.algToTransformation(standing).transformationData;
  const faces: readonly ShownFace[] = ['U', 'D', 'L', 'R', 'F', 'B'];
  const turns = faces.map(
    (face) => [face, kpuzzle.algToTransformation(face).transformationData] as const,
  );

  const orbits: StickeringMask['orbits'] = {};
  for (const orbit of kpuzzle.definition.orbits) {
    const placement = stood[orbit.orbitName];
    orbits[orbit.orbitName] = {
      pieces: Array.from({ length: orbit.numPieces }, (_, piece) => {
        // The place the piece ends up in once the cube is stood: the slot
        // whose occupant, after the rotation, is this piece.
        const place = placement === undefined ? piece : placement.permutation.indexOf(piece);
        const home = new Set<ShownFace>();
        for (const [face, turn] of turns) {
          const moved = turn[orbit.orbitName];
          if (
            moved !== undefined &&
            (moved.permutation[place] !== place || moved.orientationDelta[place] !== 0)
          ) {
            home.add(face);
          }
        }
        return {
          facelets: Array.from({ length: orbit.numOrientations }, (_, facelet) =>
            paint({ orbit: orbit.orbitName, home, facelet }),
          ),
        };
      }),
    };
  }
  return { orbits };
}

async function maskByLayer(
  layer: Layer,
  paint: (sticker: StickerAt) => Paint,
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
            paint({ orbit: orbit.orbitName, isInLayer, facelet }),
          ),
        };
      }),
    };
  }

  return { orbits };
}
