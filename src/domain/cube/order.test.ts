import { describe, expect, it } from 'vitest';
import { parseAlg, type Move } from './notation';
import { applyAlg, solvedState } from './state';
import {
  arrowsOfOrder,
  cellsOfOrder,
  lastLayerView,
  netView,
  permutationArrows,
  type NetView,
} from './views';

function moves(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text}`);
  return parsed.moves;
}

/** The six faces of a state as a 2×2 shows them, four cells each. */
function pocket(text: string): NetView {
  const net = netView(applyAlg(solvedState(), moves(text)));
  return {
    up: cellsOfOrder(net.up, 2),
    down: cellsOfOrder(net.down, 2),
    left: cellsOfOrder(net.left, 2),
    right: cellsOfOrder(net.right, 2),
    front: cellsOfOrder(net.front, 2),
    back: cellsOfOrder(net.back, 2),
  };
}

describe('cellsOfOrder', () => {
  it('hands a 3×3 back whole', () => {
    expect(cellsOfOrder([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(cellsOfOrder(['a', 'b', 'c'], 3)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the corners of a face for a 2×2, in reading order', () => {
    expect(cellsOfOrder([0, 1, 2, 3, 4, 5, 6, 7, 8], 2)).toEqual([0, 2, 6, 8]);
  });

  it('keeps the ends of a strip', () => {
    expect(cellsOfOrder(['a', 'b', 'c'], 2)).toEqual(['a', 'c']);
  });
});

describe('a 2×2 read off the corners of the model', () => {
  it('is solved when the model is', () => {
    expect(pocket('')).toEqual({
      up: ['U', 'U', 'U', 'U'],
      down: ['D', 'D', 'D', 'D'],
      left: ['L', 'L', 'L', 'L'],
      right: ['R', 'R', 'R', 'R'],
      front: ['F', 'F', 'F', 'F'],
      back: ['B', 'B', 'B', 'B'],
    });
  });

  it('turns its right half with R: the front column comes up from the bottom', () => {
    expect(pocket('R')).toMatchObject({
      front: ['F', 'D', 'F', 'D'],
      up: ['U', 'F', 'U', 'F'],
      // The back face is read from behind, so the right layer is its first column.
      back: ['U', 'B', 'U', 'B'],
      down: ['D', 'B', 'D', 'B'],
      right: ['R', 'R', 'R', 'R'],
      left: ['L', 'L', 'L', 'L'],
    });
  });

  it('turns its left half with L, the cube staying where it is', () => {
    expect(pocket('L')).toMatchObject({
      front: ['U', 'F', 'U', 'F'],
      right: ['R', 'R', 'R', 'R'],
    });
  });

  it.each([
    ['a turn of the middle slice', 'M'],
    ['an algorithm that only cycles edges', "M2 U M U2 M' U M2"],
    ['one that only flips them', "M' U M' U M' U2 M U M U M U2"],
  ])('does not see %s: it has no pieces there', (_name, alg) => {
    expect(pocket(alg)).toEqual(pocket(''));
  });

  it('comes back solved after a corner algorithm run as often as its order', () => {
    expect(pocket("R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'")).toEqual(pocket(''));
  });

  it('reads the strips round the top the same way', () => {
    const view = lastLayerView(applyAlg(solvedState(), moves("R U R' U'")));
    expect(cellsOfOrder(view.front, 2)).toEqual([view.front[0], view.front[2]]);
  });
});

describe('arrowsOfOrder', () => {
  it('hands a 3×3 its arrows back', () => {
    const arrows = permutationArrows(applyAlg(solvedState(), moves("R U R' U' R' F R2 U' R' U' R U R' F'")));
    expect(arrowsOfOrder(arrows, 3)).toEqual(arrows);
  });

  it('keeps the corner arrows for a 2×2, numbered by its four cells', () => {
    // A T perm swaps the two corners on the right and two edges.
    const arrows = permutationArrows(applyAlg(solvedState(), moves("R U R' U' R' F R2 U' R' U' R U R' F'")));
    expect(arrows).toHaveLength(2);
    expect(arrowsOfOrder(arrows, 2)).toEqual([{ from: 1, to: 3, isSwap: true }]);
  });

  it('draws nothing for an algorithm that moves edges alone', () => {
    const arrows = permutationArrows(applyAlg(solvedState(), moves("M2 U M U2 M' U M2")));
    expect(arrows.length).toBeGreaterThan(0);
    expect(arrowsOfOrder(arrows, 2)).toEqual([]);
  });
});
