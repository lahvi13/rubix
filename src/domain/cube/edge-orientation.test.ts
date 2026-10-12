import { describe, expect, it } from 'vitest';
import { badEdgeCount, isBadEdge } from './edge-orientation';
import { parseAlg } from './notation';
import { FACELETS, applyAlg, solvedState } from './state';

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
