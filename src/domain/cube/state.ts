/**
 * A 3x3x3 in 54 stickers. Deliberately not built on cubing.js: the trainer
 * draws dozens of case diagrams at once, and pulling the solver library in to
 * colour a picture would cost a heavy chunk on every list.
 *
 * Moves are not hand-written permutation tables — every sticker knows where it
 * sits in space, and a move is a rotation of the layers it touches. Tables are
 * where cube code goes wrong; a rotation either works for all six faces or for
 * none, and the tests say which.
 */

import { FACES, type Face, type Move, type MoveFamily } from './notation';

export type Vector = readonly [number, number, number];

export interface Sticker {
  /** Centre of the sticker on a 3x3x3 grid, each coordinate in -1..1. */
  readonly position: Vector;
  /** Which way the sticker faces. */
  readonly normal: Vector;
  readonly face: Face;
  /** Row and column as seen looking straight at that face, 0..2. */
  readonly row: number;
  readonly column: number;
}

/** Colour of every sticker, indexed like FACELETS. */
export type CubeState = readonly Face[];

const NORMALS: Record<Face, Vector> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

/**
 * Where row/column of a face point in space. Reading a face means looking
 * straight at it with U up (and with F up for D, B down for U — the usual
 * unfolded net).
 */
const AXES: Record<Face, { right: Vector; down: Vector }> = {
  U: { right: [1, 0, 0], down: [0, 0, 1] },
  D: { right: [1, 0, 0], down: [0, 0, -1] },
  F: { right: [1, 0, 0], down: [0, -1, 0] },
  B: { right: [-1, 0, 0], down: [0, -1, 0] },
  R: { right: [0, 0, -1], down: [0, -1, 0] },
  L: { right: [0, 0, 1], down: [0, -1, 0] },
};

function buildFacelets(): Sticker[] {
  const stickers: Sticker[] = [];
  for (const face of FACES) {
    const normal = NORMALS[face];
    const { right, down } = AXES[face];
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 3; column++) {
        const position: Vector = [
          normal[0] + right[0] * (column - 1) + down[0] * (row - 1),
          normal[1] + right[1] * (column - 1) + down[1] * (row - 1),
          normal[2] + right[2] * (column - 1) + down[2] * (row - 1),
        ];
        stickers.push({ position, normal, face, row, column });
      }
    }
  }
  return stickers;
}

/** The 54 sticker slots, in a fixed order: U, D, L, R, F, B, each row-major. */
export const FACELETS: readonly Sticker[] = buildFacelets();

const INDEX_BY_SLOT = new Map<string, number>(
  FACELETS.map((sticker, index) => [slotKey(sticker.position, sticker.normal), index]),
);

function slotKey(position: Vector, normal: Vector): string {
  return `${position.join(',')}|${normal.join(',')}`;
}

export function solvedState(): CubeState {
  return FACELETS.map((sticker) => sticker.face);
}

export function isSolved(state: CubeState): boolean {
  return FACELETS.every((sticker, index) => state[index] === sticker.face);
}

export function statesEqual(a: CubeState, b: CubeState): boolean {
  return a.length === b.length && a.every((colour, index) => colour === b[index]);
}

/** A state is worth comparing as a string when it goes into a Set or a Map. */
export function stateKey(state: CubeState): string {
  return state.join('');
}

type Axis = 0 | 1 | 2;

interface Turn {
  axis: Axis;
  /** Which layers move: coordinates along the axis. */
  layers: readonly number[];
  /**
   * Direction of a single quarter turn, as seen from the positive end of the
   * axis: 1 turns the face on that end clockwise.
   */
  direction: 1 | -1;
}

const TURNS: Record<MoveFamily, Turn> = {
  R: { axis: 0, layers: [1], direction: 1 },
  L: { axis: 0, layers: [-1], direction: -1 },
  U: { axis: 1, layers: [1], direction: 1 },
  D: { axis: 1, layers: [-1], direction: -1 },
  F: { axis: 2, layers: [1], direction: 1 },
  B: { axis: 2, layers: [-1], direction: -1 },

  Rw: { axis: 0, layers: [1, 0], direction: 1 },
  Lw: { axis: 0, layers: [-1, 0], direction: -1 },
  Uw: { axis: 1, layers: [1, 0], direction: 1 },
  Dw: { axis: 1, layers: [-1, 0], direction: -1 },
  Fw: { axis: 2, layers: [1, 0], direction: 1 },
  Bw: { axis: 2, layers: [-1, 0], direction: -1 },

  // Slices follow the face they are named after: M goes with L, E with D,
  // S with F.
  M: { axis: 0, layers: [0], direction: -1 },
  E: { axis: 1, layers: [0], direction: -1 },
  S: { axis: 2, layers: [0], direction: 1 },

  x: { axis: 0, layers: [1, 0, -1], direction: 1 },
  y: { axis: 1, layers: [1, 0, -1], direction: 1 },
  z: { axis: 2, layers: [1, 0, -1], direction: 1 },
};

/** Quarter turn about an axis, seen from its positive end, clockwise. */
function rotate(vector: Vector, axis: Axis): Vector {
  const [x, y, z] = vector;
  if (axis === 0) return [x, z, -y];
  if (axis === 1) return [-z, y, x];
  return [y, -x, z];
}

const permutations = new Map<string, readonly number[]>();

/**
 * Where each sticker comes from when the move is applied: `permutation[i]` is
 * the slot whose colour ends up at slot `i`.
 *
 * Worked out once per move and cached. Applying a move is then a single pass
 * over 54 numbers, which matters because the trainer replays algorithms by the
 * thousand when it searches for one.
 */
export function movePermutation(move: Move): readonly number[] {
  const cacheKey = `${move.family}${move.amount}`;
  const cached = permutations.get(cacheKey);
  if (cached) return cached;

  const turn = TURNS[move.family];
  const quarters = (((move.amount * turn.direction) % 4) + 4) % 4;

  const permutation = FACELETS.map((_, index) => index);
  for (const [index, sticker] of FACELETS.entries()) {
    if (!turn.layers.includes(sticker.position[turn.axis])) continue;

    let position = sticker.position;
    let normal = sticker.normal;
    for (let turned = 0; turned < quarters; turned++) {
      position = rotate(position, turn.axis);
      normal = rotate(normal, turn.axis);
    }

    const destination = INDEX_BY_SLOT.get(slotKey(position, normal));
    if (destination === undefined) throw new Error(`Move ${move.text} left the cube`);
    permutation[destination] = index;
  }

  permutations.set(cacheKey, permutation);
  return permutation;
}

export function applyMove(state: CubeState, move: Move): CubeState {
  return movePermutation(move).map((source) => {
    const colour = state[source];
    if (colour === undefined) throw new Error('Cube state is incomplete');
    return colour;
  });
}

export function applyAlg(state: CubeState, moves: readonly Move[]): CubeState {
  return moves.reduce(applyMove, state);
}

/** The state a case is in before its algorithm runs: the algorithm, undone. */
export function stateFromSetup(setup: readonly Move[]): CubeState {
  return applyAlg(solvedState(), setup);
}
