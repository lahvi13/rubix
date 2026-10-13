import { describe, expect, it } from 'vitest';
import {
  badEdgeCount,
  isBadEdge,
  isInnerPlace,
  isSettledByPartner,
  partnerOf,
} from './edge-orientation';
import { parseAlg } from './notation';
import { FACELETS, applyAlg, movePermutation, solvedState } from './state';

function after(text: string) {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`bad test alg: ${text}`);
  return applyAlg(solvedState(), parsed.moves);
}

describe('bad edges, as ZZ counts them', () => {
  it('finds none on a solved cube', () => {
    expect(badEdgeCount(solvedState())).toBe(0);
  });

  it.each(['R', "R'", 'R2', 'L', "L'", 'L2', 'U', "U'", 'U2', 'D', "D'", 'D2', 'F2', 'B2'])(
    '%s turns no edge over',
    (turn) => {
      expect(badEdgeCount(after(turn))).toBe(0);
    },
  );

  it.each(['F', "F'", 'B', "B'"])('%s turns over the four edges of its face', (turn) => {
    expect(badEdgeCount(after(turn))).toBe(4);
  });

  it('counts both faces when both have turned', () => {
    expect(badEdgeCount(after('F B'))).toBe(8);
  });

  it('keeps counting an edge that has been carried somewhere else', () => {
    // The four turned by F, then scattered by turns that turn nothing over.
    expect(badEdgeCount(after("F R U2 L' D R2 U' B2 L"))).toBe(4);
  });

  it('turns the four good again with the same face', () => {
    expect(badEdgeCount(after("F R' F'"))).toBe(2);
    expect(badEdgeCount(after("F R' F' R"))).toBe(2);
    expect(badEdgeCount(after('F F'))).toBe(0);
  });

  it('finds an edge turned over where it stands', () => {
    // The two-edge flip of the last layer: both are home, and both are wrong.
    expect(badEdgeCount(after("F R U R' U' F'"))).toBe(2);
  });

  it.each([
    // Still the front-back axis, whichever of the four ways round it the cube lies.
    ['F x2', 4],
    ['F y2', 4],
    ['F z', 4],
    ['F z2', 4],
    // A quarter turn about the vertical: the face that turned is a side one
    // now, and a side turn turns nothing over.
    ['F y', 0],
    ["F y'", 0],
  ])('reads the cube as it lies: %s has %i', (setup, count) => {
    expect(badEdgeCount(after(setup))).toBe(count);
  });

  it('never calls a corner or a centre bad', () => {
    const state = after("F R B' U F2 D' L B");
    const flagged = FACELETS.flatMap((sticker, index) =>
      isBadEdge(state, index) ? [Math.abs(sticker.position[0]) + Math.abs(sticker.position[1]) + Math.abs(sticker.position[2])] : [],
    );

    // An edge sits on exactly two of the three axes.
    expect(flagged.every((distance) => distance === 2)).toBe(true);
  });

  it('agrees with the two rules the guide gives for spotting one', () => {
    // A left or right colour on top, on the bottom or in the middle row of
    // the front or back; a top or bottom colour anywhere else.
    const state = after("F' L' D U2 L B' D R F U' B2 L' F");
    const centre = (face: string) =>
      state[FACELETS.findIndex((s) => s.face === face && s.row === 1 && s.column === 1)];
    const side = [centre('L'), centre('R')];
    const pole = [centre('U'), centre('D')];

    for (const [index, sticker] of FACELETS.entries()) {
      const partner = FACELETS.findIndex(
        (other, at) => at !== index && other.position.join() === sticker.position.join(),
      );
      const isEdge =
        FACELETS.filter((other) => other.position.join() === sticker.position.join()).length === 2;
      if (!isEdge) continue;

      const breaksARule = [index, partner].some((at) => {
        const face = FACELETS[at]?.face;
        const isMiddleRow = FACELETS[at]?.position[1] === 0;
        const isFirstKindOfPlace =
          face === 'U' || face === 'D' || ((face === 'F' || face === 'B') && isMiddleRow);
        return isFirstKindOfPlace ? side.includes(state[at]) : pole.includes(state[at]);
      });
      expect(isBadEdge(state, index), `sticker ${index}`).toBe(breaksARule);
    }
  });
});

/**
 * The way the guide says to read an edge: one sticker of it, and three
 * answers by the colour found there. Worded for a person, so it is run here
 * as worded, on every edge of a few hundred cubes.
 */
describe('reading an edge by one sticker', () => {
  const TURNS = ['U', 'D', 'R', 'L', 'F', 'B'].flatMap((face) => [face, `${face}'`, `${face}2`]);

  /** The same scrambles every run: the generator is seeded. */
  function scrambles(count: number, length: number): string[] {
    let seed = 0x2f6e2b1;
    const next = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
    return Array.from({ length: count }, () =>
      Array.from({ length }, () => TURNS[Math.floor(next() * TURNS.length)] ?? 'U').join(' '),
    );
  }

  const centreOf = (state: ReturnType<typeof solvedState>, face: string) =>
    state[FACELETS.findIndex((sticker) => sticker.face === face && sticker.row === 1 && sticker.column === 1)];

  // Held every way round: the rule is about the cube as it lies.
  it.each(['', 'y', 'y2', 'x', 'z'])('agrees with the cube on every edge, held %s', (held) => {
    for (const scramble of scrambles(200, 25)) {
      const state = after(`${held} ${scramble}`.trim());
      const isOneOf = (colour: string | undefined, faces: readonly string[]) =>
        faces.some((face) => centreOf(state, face) === colour);

      let read = 0;
      for (const index of FACELETS.keys()) {
        if (!isInnerPlace(index)) continue;
        read++;

        const colour = state[index];
        const isUndecided = isOneOf(colour, ['F', 'B']);
        const isBad = isUndecided
          ? isOneOf(state[partnerOf(index)], ['U', 'D'])
          : isOneOf(colour, ['L', 'R']);

        expect(isSettledByPartner(state, index)).toBe(isUndecided);
        expect(isBadEdge(state, index)).toBe(isBad);
      }
      expect(read).toBe(12);
    }
  });

  // Why those twelve places: the turns that turn no edge over keep them to
  // themselves, and a quarter turn of the front or back does not.
  it.each(['R', "R'", 'L', "L'", 'U', "U'", 'D', "D'", 'F2', 'B2'])(
    '%s carries no sticker into the places an edge is read in, nor out of them',
    (turn) => {
      const parsed = parseAlg(turn);
      if (!parsed.ok) throw new Error(turn);
      for (const move of parsed.moves) {
        for (const [to, from] of movePermutation(move).entries()) {
          expect(isInnerPlace(to)).toBe(isInnerPlace(from));
        }
      }
    },
  );

  it.each(['F', "F'", 'B', "B'"])('%s carries four stickers in and four out', (turn) => {
    const parsed = parseAlg(turn);
    if (!parsed.ok) throw new Error(turn);
    const [move] = parsed.moves;
    if (!move) throw new Error(turn);
    const carried = [...movePermutation(move).entries()];

    expect(carried.filter(([to, from]) => isInnerPlace(to) && !isInnerPlace(from))).toHaveLength(4);
    expect(carried.filter(([to, from]) => !isInnerPlace(to) && isInnerPlace(from))).toHaveLength(4);
  });

  it('has no second sticker to ask about on a corner or a centre', () => {
    const corner = FACELETS.findIndex((sticker) => sticker.row === 0 && sticker.column === 0);
    const centre = FACELETS.findIndex((sticker) => sticker.row === 1 && sticker.column === 1);

    expect(partnerOf(corner)).toBe(-1);
    expect(partnerOf(centre)).toBe(-1);
    expect(isSettledByPartner(solvedState(), centre)).toBe(false);
  });
});
