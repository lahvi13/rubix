import { describe, expect, it } from 'vitest';
import { CROSS_HOLDS, MAX_CROSS_MOVES, solveCross } from './cross-solver';
import { formatAlg, parseAlg, type Move } from './notation';
import { FACELETS, applyAlg, solvedState, type CubeState } from './state';

function movesOf(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text}`);
  return parsed.moves;
}

function scrambled(text: string): CubeState {
  return applyAlg(solvedState(), movesOf(text));
}

/** The colour of a face's centre — the only piece a rotation cannot lie about. */
function centreOf(state: CubeState, face: string): string | undefined {
  const index = FACELETS.findIndex(
    (sticker) =>
      sticker.face === face &&
      sticker.position.filter((coordinate) => coordinate === 0).length === 2,
  );
  return state[index];
}

/**
 * The four bottom-layer edges home. Judged against the centres, not against
 * the colours a solved cube starts with: a cross stays solved when the whole
 * cube is turned, and half of these tests turn it.
 */
function isCrossSolved(state: CubeState): boolean {
  return FACELETS.every((sticker, index) => {
    const [x, y, z] = sticker.position;
    const isEdge = [x, y, z].filter((coordinate) => coordinate === 0).length === 1;
    if (!isEdge || y !== -1) return true;
    return state[index] === centreOf(state, sticker.face);
  });
}

/** Real scrambles; the solver has to cope with whatever it is handed. */
const SCRAMBLES = [
  "R U R' U' F2 L D B2",
  "D2 L' B2 R2 U' F' L U R2 D",
  "F R U' L2 D B' R2 U D' F2",
  "B2 D' R L F U2 B L' D R2 U",
  "U2 D R L U D B' L' U2 B2 D' L2 U L2 B2 D F2 U F2 B R2",
  "R2 D2 L U' B' R2 D' R2 F' B2 L' D2 R L2 U2 R' B2 L2 F2 R D'",
];

describe('solveCross', () => {
  it('has nothing to do on a solved cube', () => {
    expect(solveCross(solvedState())).toEqual([]);
  });

  it.each(SCRAMBLES)('solves the cross after %s', (scramble) => {
    const state = scrambled(scramble);
    const solution = solveCross(state);

    expect(solution).not.toBeNull();
    if (solution === null) return;
    expect(isCrossSolved(applyAlg(state, solution))).toBe(true);
  });

  it('undoes a cross taken apart in as many moves as it took', () => {
    // Each half turn displaces one cross edge and nothing else can put it back
    // in one move, so four is optimal. The four are independent of each other,
    // so any order of them is an equally short answer.
    const state = scrambled('F2 R2 B2 L2');
    const solution = solveCross(state) ?? [];

    expect(solution).toHaveLength(4);
    expect(formatAlg(solution).split(' ').sort()).toEqual(['B2', 'F2', 'L2', 'R2']);
    expect(isCrossSolved(applyAlg(state, solution))).toBe(true);
  });

  it('never needs more than eight moves', () => {
    // Pseudo-random walks rather than a fixed list: the bound is about every
    // position, not about the six scrambles above.
    let seed = 12_345;
    const random = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    const suffixes = ['', "'", '2'];

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const moves = Array.from({ length: 25 }, () => {
        const face = faces[Math.floor(random() * faces.length)] ?? 'U';
        return `${face}${suffixes[Math.floor(random() * suffixes.length)] ?? ''}`;
      }).join(' ');

      const state = scrambled(moves);
      const solution = solveCross(state);
      expect(solution).not.toBeNull();
      if (solution === null) continue;
      expect(solution.length).toBeLessThanOrEqual(MAX_CROSS_MOVES);
      expect(isCrossSolved(applyAlg(state, solution))).toBe(true);
    }
  });

  it('is optimal: no single move leads to a shorter solution', () => {
    const state = scrambled("D2 L' B2 R2 U' F' L U R2 D");
    const best = solveCross(state)?.length ?? 0;

    for (const text of ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'D', "D'", 'D2']) {
      const after = solveCross(applyAlg(state, movesOf(text)))?.length ?? 0;
      // A move can only ever get one step closer.
      expect(after).toBeGreaterThanOrEqual(best - 1);
    }
  });

  it('offers four ways to hold the scrambled cube, one per side', () => {
    expect(CROSS_HOLDS.map((hold) => hold.front).sort()).toEqual(['B', 'F', 'L', 'R']);
  });

  it('solves the white cross for the cube as it is actually held', () => {
    // A scramble is performed with white on top, so the cross to solve is the
    // one that starts up there; the hold turns the cube over first.
    const state = scrambled("D2 L' B2 R2 U' F' L U R2 D");

    for (const hold of CROSS_HOLDS) {
      const held = applyAlg(state, hold.rotation);
      const solution = solveCross(held);

      expect(solution).not.toBeNull();
      if (solution === null) continue;
      expect(solution.length).toBeLessThanOrEqual(MAX_CROSS_MOVES);
      expect(isCrossSolved(applyAlg(held, solution))).toBe(true);
      // Same cube, same work: turning it round cannot make the cross shorter.
      expect(solution).toHaveLength(solveCross(applyAlg(state, CROSS_HOLDS[0]?.rotation ?? []))?.length ?? -1);
    }
  });

  it('puts the cross colour down whichever way the cube is held', () => {
    const state = scrambled('R U F2 L D2');
    for (const hold of CROSS_HOLDS) {
      const held = applyAlg(state, hold.rotation);
      const solved = applyAlg(held, solveCross(held) ?? []);
      // The face the cross ends on is the one that was on top for the scramble.
      expect(centreOf(solved, 'D')).toBe('U');
    }
  });

  it('refuses a state whose cross edges are not all there', () => {
    const broken = [...solvedState()];
    // A cross edge sticker, not a corner one: the bottom layer edges are the
    // only stickers the solver reads.
    const edge = FACELETS.findIndex(
      (sticker) =>
        sticker.face === 'D' &&
        sticker.position.filter((coordinate) => coordinate === 0).length === 1,
    );
    broken[edge] = 'U';
    expect(solveCross(broken)).toBeNull();
  });
});
