/**
 * Optimal cross solutions.
 *
 * The cross is four edges, so the whole problem is tiny: each of them sits in
 * one of twelve slots either way round, which makes 24 places per piece and
 * fewer than 200k reachable positions altogether. That fits in one byte array
 * of distances, breadth-first from the solved cross — and once it exists, a
 * solution is not searched for at all, it is read off by walking downhill.
 * Every answer is therefore the shortest one that exists (in the half-turn
 * metric, the one cross solvers quote), and the walk costs microseconds.
 *
 * Nothing here knows about cubing.js: the moves come from our own model, so
 * the twenty-four places and how a turn moves between them are derived from
 * the same permutations the rest of the app is tested on.
 */

import { FACES, parseAlg, parseMove, type Face, type Move } from './notation';
import { FACELETS, applyAlg, movePermutation, solvedState, type CubeState } from './state';

/** The cross is the D face; U is yellow in this model (see cube-skins.ts). */
const CROSS_FACE: Face = 'D';

/** The four cross edges, named by the side colour each one carries. */
const CROSS_SIDES: readonly Face[] = ['F', 'R', 'B', 'L'];

/** No cross needs more than this. The table proves it; a test checks it. */
export const MAX_CROSS_MOVES = 8;

/** Face turns only — the metric every published cross solution is counted in. */
const MOVE_TEXTS = [
  'U',
  "U'",
  'U2',
  'D',
  "D'",
  'D2',
  'L',
  "L'",
  'L2',
  'R',
  "R'",
  'R2',
  'F',
  "F'",
  'F2',
  'B',
  "B'",
  'B2',
] as const;

const MOVES: readonly Move[] = MOVE_TEXTS.map((text) => {
  const move = parseMove(text);
  if (move === null) throw new Error(`Bad move: ${text}`);
  return move;
});

const PLACES = 24;
const STATES = PLACES ** 4;

/**
 * A place an edge can be: the facelet holding its cross-coloured sticker and
 * the facelet holding the other one. Two entries per slot, one for each way
 * round, so orientation needs no separate bookkeeping.
 */
interface Place {
  cross: number;
  side: number;
}

function buildPlaces(): Place[] {
  const pairs = new Map<string, number[]>();
  for (const [index, sticker] of FACELETS.entries()) {
    // An edge cubie sits where exactly one coordinate is zero; a corner has
    // none and a centre has two.
    const zeros = sticker.position.filter((coordinate) => coordinate === 0).length;
    if (zeros !== 1) continue;

    const key = sticker.position.join(',');
    const stickers = pairs.get(key);
    if (stickers) stickers.push(index);
    else pairs.set(key, [index]);
  }

  const places: Place[] = [];
  for (const [first, second] of pairs.values()) {
    if (first === undefined || second === undefined) throw new Error('Edge with one sticker');
    places.push({ cross: first, side: second });
    places.push({ cross: second, side: first });
  }
  return places;
}

const PLACES_BY_STICKERS = new Map<string, number>();
const ALL_PLACES: readonly Place[] = buildPlaces();
for (const [index, place] of ALL_PLACES.entries()) {
  PLACES_BY_STICKERS.set(`${place.cross}-${place.side}`, index);
}

/** Where each place goes when the move is performed, one table per move. */
function buildTransitions(): Uint8Array[] {
  return MOVES.map((move) => {
    // movePermutation says where a sticker comes FROM; a piece needs the way
    // round it goes TO.
    const permutation = movePermutation(move);
    const destinations = new Array<number>(permutation.length);
    for (const [destination, source] of permutation.entries()) destinations[source] = destination;

    const table = new Uint8Array(PLACES);
    for (const [index, place] of ALL_PLACES.entries()) {
      const cross = destinations[place.cross];
      const side = destinations[place.side];
      const moved = cross === undefined || side === undefined
        ? undefined
        : PLACES_BY_STICKERS.get(`${cross}-${side}`);
      if (moved === undefined) throw new Error(`Move ${move.text} lost an edge`);
      table[index] = moved;
    }
    return table;
  });
}

const TRANSITIONS: readonly Uint8Array[] = buildTransitions();

function encode(places: readonly number[]): number {
  const [first = 0, second = 0, third = 0, fourth = 0] = places;
  return first + PLACES * (second + PLACES * (third + PLACES * fourth));
}

function step(index: number, table: Uint8Array): number {
  const first = table[index % PLACES] ?? 0;
  const second = table[Math.floor(index / PLACES) % PLACES] ?? 0;
  const third = table[Math.floor(index / PLACES ** 2) % PLACES] ?? 0;
  const fourth = table[Math.floor(index / PLACES ** 3) % PLACES] ?? 0;
  return first + PLACES * (second + PLACES * (third + PLACES * fourth));
}

/** The place each cross edge belongs in, in CROSS_SIDES order. */
const SOLVED_PLACES = CROSS_SIDES.map((side) => {
  const index = ALL_PLACES.findIndex(
    (place) =>
      FACELETS[place.cross]?.face === CROSS_FACE && FACELETS[place.side]?.face === side,
  );
  if (index === -1) throw new Error(`No home for the ${side} cross edge`);
  return index;
});

const UNVISITED = 255;
let distances: Uint8Array | null = null;

/**
 * Distance from every cross position to the solved one. Built once, in about
 * a tenth of a second, and worth doing before the user asks — see
 * warmCrossSolver.
 */
function crossDistances(): Uint8Array {
  if (distances !== null) return distances;

  const table = new Uint8Array(STATES).fill(UNVISITED);
  const solved = encode(SOLVED_PLACES);
  table[solved] = 0;

  // Every reachable position is queued exactly once: 24*22*20*18 of them.
  const queue = new Int32Array(190_080);
  queue[0] = solved;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const index = queue[head++] ?? 0;
    const next = (table[index] ?? 0) + 1;

    for (const transition of TRANSITIONS) {
      const neighbour = step(index, transition);
      if (table[neighbour] !== UNVISITED) continue;
      table[neighbour] = next;
      queue[tail++] = neighbour;
    }
  }

  distances = table;
  return table;
}

/**
 * Builds the table now rather than when somebody is waiting for an answer.
 * Safe to call more than once; the second call does nothing.
 */
export function warmCrossSolver(): void {
  crossDistances();
}

const CENTRES = new Map<Face, number>(
  FACES.map((face) => [
    face,
    FACELETS.findIndex(
      (sticker) =>
        sticker.face === face &&
        sticker.position.filter((coordinate) => coordinate === 0).length === 2,
    ),
  ]),
);

/**
 * Which face each colour belongs to *on this cube*, read off the centres.
 *
 * Without this the solver could only ever solve the cross of the face that
 * started at the bottom. Centres never move relative to each other, so they
 * are what says which colour is "down" now — and that makes the answer the
 * cross of the face the cube is currently sitting on, whichever way it was
 * picked up.
 */
function facesByColour(state: CubeState): Map<Face, Face> | null {
  const byColour = new Map<Face, Face>();
  for (const [face, index] of CENTRES) {
    const colour = state[index];
    if (colour === undefined) return null;
    byColour.set(colour, face);
  }
  return byColour.size === FACES.length ? byColour : null;
}

/** Where the four cross edges are, or null if this is not a cube state. */
function placesOf(state: CubeState): number[] | null {
  const byColour = facesByColour(state);
  if (byColour === null) return null;

  const found: number[] = [];
  for (const side of CROSS_SIDES) {
    const index = ALL_PLACES.findIndex(
      (place) =>
        byColour.get(state[place.cross] ?? 'U') === CROSS_FACE &&
        byColour.get(state[place.side] ?? 'U') === side,
    );
    if (index === -1) return null;
    found.push(index);
  }
  return found;
}

/**
 * The shortest way to the cross of whichever face is currently down, or null
 * when the state has no cross to solve (a cube built by hand rather than by
 * turning one).
 *
 * The moves are for the cube exactly as the state describes it, so turn the
 * state into the position it is being held in first — see CROSS_HOLDS — and
 * the answer needs no rewriting afterwards.
 */
export function solveCross(state: CubeState): Move[] | null {
  const places = placesOf(state);
  if (places === null) return null;

  const table = crossDistances();
  let index = encode(places);
  let distance = table[index] ?? UNVISITED;
  if (distance === UNVISITED) return null;

  const solution: Move[] = [];
  while (distance > 0) {
    const next = MOVES.findIndex((_, moveIndex) => {
      const transition = TRANSITIONS[moveIndex];
      if (transition === undefined) return false;
      return table[step(index, transition)] === distance - 1;
    });
    // Every position above zero has a neighbour one step closer; the table
    // was built by walking outwards from the solved one.
    const move = MOVES[next];
    const transition = TRANSITIONS[next];
    if (move === undefined || transition === undefined) return null;

    solution.push(move);
    index = step(index, transition);
    distance -= 1;
  }
  return solution;
}

/**
 * The four ways to pick the cube up once it is scrambled: cross face down,
 * and one of the four sides towards you. Which one is a matter of taste and
 * of what came up — so the screen offers all four and the reader taps the
 * colour they are actually looking at.
 *
 * A scramble is performed with white on top (see withWhiteTop), and this app
 * models exactly that frame, so putting the cross down means turning the cube
 * over: x2, and then however many quarter turns of y.
 */
export interface CrossHold {
  /** Applied to the scrambled state to get the cube as it is now held. */
  rotation: Move[];
  /** The face that ends up at the front; its colour is what names the choice. */
  front: Face;
}

// Ordered so the fronts come out front, right, back, left of the cube as it
// was scrambled, which is the order the app names sides in everywhere else.
const HOLD_TEXTS = ['x2 y2', 'x2 y', 'x2', "x2 y'"] as const;

export const CROSS_HOLDS: readonly CrossHold[] = HOLD_TEXTS.map((text) => {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`Bad hold: ${text}`);

  const turned = applyAlg(solvedState(), parsed.moves);
  const front = FACELETS.find(
    (sticker, index) =>
      sticker.face === 'F' &&
      sticker.position.filter((coordinate) => coordinate === 0).length === 2 &&
      turned[index] !== undefined,
  );
  const face = front === undefined ? undefined : turned[FACELETS.indexOf(front)];
  if (face === undefined) throw new Error(`Hold ${text} has no front`);

  return { rotation: parsed.moves, front: face };
});
