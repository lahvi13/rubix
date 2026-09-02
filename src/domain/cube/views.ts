/**
 * What a case diagram shows. These functions pick stickers out of a cube
 * state; where those stickers end up on screen is the drawing code's business.
 *
 * `null` means "this sticker does not matter for the case" — an OLL diagram is
 * yellow and grey, not a full colour picture of a cube nobody has to solve,
 * and an F2L diagram shows the pair being solved and little else.
 */

import type { Face } from './notation';
import { FACELETS, type CubeState } from './state';

export type Stickering =
  /** Every sticker in its own colour. */
  | 'full'
  /** Only whether a sticker faces up: the last layer, orientation only. */
  | 'orientation'
  /** Orientation, edges only — the first look of two-look OLL. */
  | 'edgeOrientation'
  /** Colours of the corners only, to read the corner permutation. */
  | 'corners'
  /** Colours of the edges only, to read the edge permutation. */
  | 'edges'
  /** Only the pieces of the front-right pair. */
  | 'pair';

export type Cell = Face | null;

export interface LastLayerView {
  /** U face, row-major; row 0 is the back row, as in every LL diagram. */
  top: Cell[];
  /** The strip of side stickers touching the top layer, in drawing order. */
  back: Cell[];
  right: Cell[];
  front: Cell[];
  left: Cell[];
}

export interface IsometricView {
  top: Cell[];
  front: Cell[];
  right: Cell[];
}

const INDEX_BY_SPOT = new Map<string, number>(
  FACELETS.map((sticker, index) => [`${sticker.face}${sticker.row}${sticker.column}`, index]),
);

/** The stickers of each cubie, so a piece can be recognised by its colours. */
const STICKERS_BY_CUBIE = new Map<string, number[]>();
for (const [index, sticker] of FACELETS.entries()) {
  const cubie = sticker.position.join(',');
  STICKERS_BY_CUBIE.set(cubie, [...(STICKERS_BY_CUBIE.get(cubie) ?? []), index]);
}

/** Colours of the two pieces that belong in the front-right slot. */
const PAIR_PIECES = ['DFR', 'FR'];

function indexOf(face: Face, row: number, column: number): number {
  const index = INDEX_BY_SPOT.get(`${face}${row}${column}`);
  if (index === undefined) throw new Error(`No sticker at ${face}${row}${column}`);
  return index;
}

function colourAt(state: CubeState, index: number): Face {
  const colour = state[index];
  if (colour === undefined) throw new Error(`Cube state is incomplete at ${index}`);
  return colour;
}

function siblingsOf(index: number): number[] {
  const sticker = FACELETS[index];
  if (!sticker) return [];
  return STICKERS_BY_CUBIE.get(sticker.position.join(',')) ?? [];
}

function isPairSticker(state: CubeState, index: number): boolean {
  const colours = siblingsOf(index)
    .map((sibling) => colourAt(state, sibling))
    .sort()
    .join('');
  return PAIR_PIECES.includes(colours);
}

/** A piece is told apart by how many stickers it has: 3, 2 or 1. */
function pieceSize(index: number): number {
  return siblingsOf(index).length;
}

function cell(state: CubeState, index: number, stickering: Stickering): Cell {
  const colour = colourAt(state, index);

  switch (stickering) {
    case 'full':
      return colour;
    case 'orientation':
      return colour === 'U' ? 'U' : null;
    case 'edgeOrientation': {
      // The first look builds the cross, so only the top face of the edges
      // counts. Corners belong to the second look, and a yellow sticker
      // pointing sideways is noise here.
      const isTop = FACELETS[index]?.face === 'U';
      return isTop && pieceSize(index) !== 3 && colour === 'U' ? 'U' : null;
    }
    case 'corners':
      return pieceSize(index) === 3 ? colour : null;
    case 'edges':
      return pieceSize(index) === 2 ? colour : null;
    case 'pair':
      return isPairSticker(state, index) ? colour : null;
  }
}

function faceGrid(state: CubeState, face: Face, stickering: Stickering): Cell[] {
  const cells: Cell[] = [];
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      cells.push(cell(state, indexOf(face, row, column), stickering));
    }
  }
  return cells;
}

/**
 * The classic last-layer picture: the U face with the top row of the four side
 * faces around it.
 *
 * Every strip comes back in the order it is drawn, going round the picture.
 * Two of them are seen from the far side in this view — the back face, and the
 * right face read downwards — and are reversed here, so a case can never come
 * out mirrored on screen.
 */
export function lastLayerView(state: CubeState, stickering: Stickering = 'full'): LastLayerView {
  const strip = (face: Face, reversed = false): Cell[] => {
    const columns = reversed ? [2, 1, 0] : [0, 1, 2];
    return columns.map((column) => cell(state, indexOf(face, 0, column), stickering));
  };

  return {
    top: faceGrid(state, 'U', stickering),
    back: strip('B', true),
    right: strip('R', true),
    front: strip('F'),
    left: strip('L'),
  };
}

/** Three faces of the cube as drawn in an isometric view, for F2L cases. */
export function isometricView(state: CubeState, stickering: Stickering = 'full'): IsometricView {
  return {
    top: faceGrid(state, 'U', stickering),
    front: faceGrid(state, 'F', stickering),
    right: faceGrid(state, 'R', stickering),
  };
}

export interface NetView {
  up: Cell[];
  left: Cell[];
  front: Cell[];
  right: Cell[];
  back: Cell[];
  down: Cell[];
}

/**
 * The unfolded cube, all six faces at once. What a scramble preview needs: a
 * corner view hides half the cube, and the half it hides is exactly where the
 * piece you are hunting for tends to be.
 */
export function netView(state: CubeState, stickering: Stickering = 'full'): NetView {
  return {
    up: faceGrid(state, 'U', stickering),
    left: faceGrid(state, 'L', stickering),
    front: faceGrid(state, 'F', stickering),
    right: faceGrid(state, 'R', stickering),
    back: faceGrid(state, 'B', stickering),
    down: faceGrid(state, 'D', stickering),
  };
}
