/**
 * Generates src/db/seed/f2l.json.
 *
 * F2L is not typed in by hand. Every case is "the front-right pair is
 * somewhere, the rest of the first two layers is solved", so the whole set can
 * be enumerated: search outwards from a solved cube over R, U and F, and keep
 * the first sequence that puts the pair in each position it can be in. Undo
 * that sequence and you have the algorithm — the shortest one in that move
 * set, verified by construction rather than by memory.
 *
 * Run with: npm run f2l
 */

import { writeFileSync } from 'node:fs';
import { formatAlg, invertAlg, parseAlg, type Move } from '../src/domain/cube/notation';
import { FACELETS, movePermutation, solvedState } from '../src/domain/cube/state';

const SEARCH_MOVES = ["R", "R2", "R'", "U", "U2", "U'", "F", "F2", "F'"];
const MAX_DEPTH = 9;

/** Corner and edge of the front-right slot, the slot every case is solved in. */
const SLOT_CORNER: readonly string[] = ['D', 'F', 'R'];
const SLOT_EDGE: readonly string[] = ['F', 'R'];

function parseOne(text: string): Move {
  const parsed = parseAlg(text);
  if (!parsed.ok || parsed.moves.length !== 1 || !parsed.moves[0]) {
    throw new Error(`bad move: ${text}`);
  }
  return parsed.moves[0];
}

const moves = SEARCH_MOVES.map(parseOne);
const permutations = moves.map((move) => Uint8Array.from(movePermutation(move)));
const families = moves.map((move) => move.family);

const solved = Uint8Array.from(solvedState().map((face) => face.charCodeAt(0)));

/** Cubie of each sticker, and the stickers that share it. */
const cubieOf = FACELETS.map((sticker) => sticker.position.join(','));
const cubies = [...new Set(cubieOf)];
const stickersOfCubie = new Map<string, number[]>(
  cubies.map((cubie) => [cubie, cubieOf.flatMap((other, index) => (other === cubie ? [index] : []))]),
);

/** Stickers that must be solved in every case: everything but the top layer and the slot. */
const mustBeSolved = FACELETS.flatMap((sticker, index) => {
  const [x, y, z] = sticker.position;
  const inTopLayer = y === 1;
  const inSlot = x === 1 && z === 1 && y !== 1;
  return inTopLayer || inSlot ? [] : [index];
});

function apply(state: Uint8Array, moveIndex: number): Uint8Array {
  const permutation = permutations[moveIndex];
  if (!permutation) throw new Error('unknown move');
  const next = new Uint8Array(54);
  for (let index = 0; index < 54; index++) next[index] = state[permutation[index] ?? 0] ?? 0;
  return next;
}

function isF2lIntact(state: Uint8Array): boolean {
  return mustBeSolved.every((index) => state[index] === solved[index]);
}

/**
 * Where the pair is, and nothing else: which cubie holds each of the two
 * pieces and which way round it sits. Two cubes with the same signature are
 * the same case however their last layer happens to be arranged.
 */
function pairSignature(state: Uint8Array): string | null {
  let corner: string | null = null;
  let edge: string | null = null;

  for (const cubie of cubies) {
    const stickers = stickersOfCubie.get(cubie) ?? [];
    const colours = stickers.map((index) => String.fromCharCode(state[index] ?? 0));
    const sorted = [...colours].sort().join('');

    if (sorted === [...SLOT_CORNER].sort().join('')) {
      corner = `${cubie}:${stickers.map((index, at) => `${FACELETS[index]?.normal.join('')}${colours[at]}`).join('')}`;
    } else if (colours.length === 2 && sorted === [...SLOT_EDGE].sort().join('')) {
      edge = `${cubie}:${stickers.map((index, at) => `${FACELETS[index]?.normal.join('')}${colours[at]}`).join('')}`;
    }
  }

  return corner === null || edge === null ? null : `${corner}|${edge}`;
}

/** Depth-first, shallowest first: the first sequence found for a case is the shortest. */
function search(): Map<string, number[]> {
  const found = new Map<string, number[]>();
  const path: number[] = [];

  const visit = (state: Uint8Array, remaining: number): void => {
    if (isF2lIntact(state)) {
      const signature = pairSignature(state);
      if (signature !== null && !found.has(signature)) found.set(signature, [...path]);
    }
    if (remaining === 0) return;

    const last = path.length > 0 ? families[path[path.length - 1] ?? 0] : null;
    for (let moveIndex = 0; moveIndex < moves.length; moveIndex++) {
      if (families[moveIndex] === last) continue;
      path.push(moveIndex);
      visit(apply(state, moveIndex), remaining - 1);
      path.pop();
    }
  };

  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    visit(solved, depth);
    process.stdout.write(`depth ${depth}: ${found.size} placements\n`);
    if (found.size >= 150) break;
  }
  return found;
}

/** Cases that differ only by a turn of the top layer are one case. */
function aufClass(signature: string, found: Map<string, number[]>): string {
  const uIndex = SEARCH_MOVES.indexOf('U');
  const members: string[] = [];
  const path = found.get(signature);
  if (!path) throw new Error('missing path');

  let state = path.reduce((current, moveIndex) => apply(current, moveIndex), solved);
  for (let turn = 0; turn < 4; turn++) {
    const turned = pairSignature(state);
    if (turned !== null) members.push(turned);
    state = apply(state, uIndex);
  }
  return members.sort().join('#');
}

/** Where each piece of the pair sits, read back out of a signature. */
function cubiesOf(signature: string): { corner: string; edge: string } {
  const [corner = '', edge = ''] = signature.split('|');
  return { corner: corner.split(':')[0] ?? '', edge: edge.split(':')[0] ?? '' };
}

/**
 * A case is only worth drawing if you can see how the pieces are turned, and
 * the diagram shows three faces: up, front and right. A corner at the back has
 * its cross-coloured sticker hidden, which is the one thing you look for.
 *
 * Every turn of the top layer gives the same case, so there is a choice here;
 * the algorithm of the chosen one carries the matching AUF, exactly as a
 * written F2L algorithm does.
 */
function isReadable(signature: string): boolean {
  const { corner, edge } = cubiesOf(signature);
  const cornerShown = corner === '1,1,1' || corner === '1,-1,1';
  const edgeShown = edge === '0,1,1' || edge === '1,1,0' || edge === '1,0,1';
  return cornerShown && edgeShown;
}

/** Second best: at least the corner, which carries the cross colour. */
function showsCorner(signature: string): boolean {
  const { corner } = cubiesOf(signature);
  return corner === '1,1,1' || corner === '1,-1,1';
}

interface Candidate {
  signature: string;
  alg: string;
}

/** Readable first, then short — a case you cannot read is not worth two moves. */
function isBetter(candidate: Candidate, current: Candidate): boolean {
  const rank = (entry: Candidate): number =>
    (isReadable(entry.signature) ? 2 : 0) + (showsCorner(entry.signature) ? 1 : 0);

  const difference = rank(candidate) - rank(current);
  if (difference !== 0) return difference > 0;
  return candidate.alg.split(' ').length < current.alg.split(' ').length;
}

function groupOf(signature: string): string {
  const [corner = '', edge = ''] = signature.split('|');
  const cornerCubie = corner.split(':')[0] ?? '';
  const edgeCubie = edge.split(':')[0] ?? '';
  const cornerInSlot = cornerCubie === '1,-1,1';
  const edgeInSlot = edgeCubie === '1,0,1';

  if (cornerInSlot && edgeInSlot) return 'Pair in the slot';
  if (cornerInSlot) return 'Corner in the slot';
  if (edgeInSlot) return 'Edge in the slot';

  // Where the cross-coloured sticker of the corner points decides how the case
  // is recognised, which is how every F2L list groups these.
  const facingUp = corner.includes('010D');
  return facingUp ? 'Cross colour on top' : 'Cross colour on the side';
}

const GROUP_ORDER = [
  'Cross colour on top',
  'Cross colour on the side',
  'Corner in the slot',
  'Edge in the slot',
  'Pair in the slot',
];

function main(): void {
  const found = search();
  process.stdout.write(`found ${found.size} placements\n`);

  const classes = new Map<string, { signature: string; alg: string }>();
  for (const [signature, path] of found) {
    if (path.length === 0) continue; // the solved cube is not a case

    const algMoves = invertAlg(path.map((moveIndex) => moves[moveIndex] ?? moves[0]).filter(isMove));
    const alg = formatAlg(algMoves);
    const key = aufClass(signature, found);
    const current = classes.get(key);
    if (!current || isBetter({ signature, alg }, current)) classes.set(key, { signature, alg });
  }

  const cases = [...classes.values()]
    .map((entry) => ({ ...entry, group: groupOf(entry.signature) }))
    .sort((a, b) => {
      const byGroup = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
      if (byGroup !== 0) return byGroup;
      const byLength = a.alg.split(' ').length - b.alg.split(' ').length;
      return byLength !== 0 ? byLength : a.alg.localeCompare(b.alg);
    })
    .map((entry, index) => ({
      id: `f2l-${index + 1}`,
      name: `F2L ${index + 1}`,
      group: entry.group,
      alg: entry.alg,
    }));

  process.stdout.write(`writing ${cases.length} cases\n`);
  const json = { packVersion: 1, set: { id: 'f2l', name: 'F2L' }, cases };
  writeFileSync('src/db/seed/f2l.json', `${JSON.stringify(json, null, 2)}\n`);
}

function isMove(move: Move | undefined): move is Move {
  return move !== undefined;
}

main();
