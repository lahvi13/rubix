import { describe, expect, it } from 'vitest';
import { parseAlg, type Move } from './notation';
import { applyAlg, solvedState } from './state';
import { isSolvedAsShown, isometricView, lastLayerView, netView, permutationArrows } from './views';

function alg(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`bad test alg: ${text}`);
  return parsed.moves;
}

const after = (text: string) => applyAlg(solvedState(), alg(text));

/** Reads a picture written as a string, where a dot is a grey sticker. */
const dotToNull = (cell: string) => (cell === '.' ? null : cell);

describe('lastLayerView', () => {
  it('shows a solved cube as one colour on top and matching sides', () => {
    const view = lastLayerView(solvedState());

    expect(view.top).toEqual(Array.from({ length: 9 }, () => 'U'));
    expect(view.front).toEqual(['F', 'F', 'F']);
    expect(view.back).toEqual(['B', 'B', 'B']);
    expect(view.left).toEqual(['L', 'L', 'L']);
    expect(view.right).toEqual(['R', 'R', 'R']);
  });

  it('greys out everything but orientation when asked', () => {
    // Sune leaves three corners twisted, so three of the nine top stickers
    // are not yellow — that is exactly the picture an OLL diagram shows.
    const view = lastLayerView(after("R U R' U R U2 R'"), 'orientation');

    expect(view.top.filter((sticker) => sticker === 'U')).toHaveLength(6);
    expect(view.top.filter((sticker) => sticker === null)).toHaveLength(3);
    expect(view.top[4]).toBe('U');
  });

  it('keeps the top layer intact for a permutation case', () => {
    const view = lastLayerView(after("R U R' U' R' F R2 U' R' U' R U R' F'"), 'orientation');

    // A T perm only moves pieces around, so every top sticker stays yellow.
    expect(view.top.every((sticker) => sticker === 'U')).toBe(true);
  });

  it('carries each side strip round with a U turn', () => {
    // U clockwise sends front to left, left to back, back to right.
    const view = lastLayerView(after('U'));

    expect(view.left).toEqual(['F', 'F', 'F']);
    expect(view.back).toEqual(['L', 'L', 'L']);
    expect(view.right).toEqual(['B', 'B', 'B']);
    expect(view.front).toEqual(['R', 'R', 'R']);
  });

  it('places a single turned sticker where the cube actually has it', () => {
    // R lifts the front column onto the top and pushes the top one to the back.
    const view = lastLayerView(after('R'));

    expect(view.top).toEqual(['U', 'U', 'F', 'U', 'U', 'F', 'U', 'U', 'F']);
    expect(view.right).toEqual(['R', 'R', 'R']);
    // Drawn left to right, so the sticker R pushed onto the back face sits at
    // the right of the strip, on the side of the cube R turned.
    expect(view.back).toEqual(['B', 'B', 'U']);
    expect(view.front).toEqual(['F', 'F', 'D']);
  });

  it('draws each side strip from the same side of the picture', () => {
    // F sends the top layer onto the right face; that sticker belongs at the
    // front of the cube, which is the bottom of the right strip.
    const view = lastLayerView(after('F'));

    expect(view.right[2]).toBe('U');
    // The front face turned onto itself, so its strip is unchanged.
    expect(view.front).toEqual(['F', 'F', 'F']);
  });
});

describe('first two layers stickering', () => {
  it('shows the two layers the pair goes into, and none of the layer above', () => {
    const view = isometricView(solvedState(), 'firstTwoLayers');

    // Nothing of the last layer: on a solved cube the pair is already in its
    // slot, so the top face has nothing of its own to show.
    expect(view.top).toEqual(new Array(9).fill(null));
    // Both faces keep their lower two rows, which is where the slots are.
    expect(view.front).toEqual([null, null, null, 'F', 'F', 'F', 'F', 'F', 'F']);
    expect(view.right).toEqual([null, null, null, 'R', 'R', 'R', 'R', 'R', 'R']);
  });

  it('follows the pair when the algorithm takes it out of the slot', () => {
    const view = isometricView(after("R U R'"), 'firstTwoLayers');

    // The pair is up in the last layer now, and it is the one thing shown
    // there.
    expect(view.top.some((cell) => cell !== null)).toBe(true);
    // Its slot reads as a hole: the last-layer pieces that dropped into it
    // are drawn as nothing, not as pieces that belong there.
    expect(view.front.slice(3).filter((cell) => cell === null).length).toBeGreaterThan(0);
  });
});

describe('two-look stickerings', () => {
  it('shows only the edges of the cross while the corners are still to come', () => {
    // Two edges of the cross in place, two not. Corners belong to the second
    // look and the sides of the cube say nothing here, so both stay grey.
    const view = lastLayerView(after("F R U R' U' F'"), 'edgeOrientation');

    expect(view.top).toEqual(['.', 'U', '.', 'U', 'U', '.', '.', '.', '.'].map(dotToNull));
    expect(view.front.every((cell) => cell === null)).toBe(true);
    expect(view.right.every((cell) => cell === null)).toBe(true);
  });

  it('shows corner colours alone, so headlights can be read', () => {
    const view = lastLayerView(after("R U R' U' R' F R2 U' R' U' R U R' F'"), 'corners');

    // Corners sit at the four corners of the top face; edges and centre go grey.
    expect([view.top[1], view.top[3], view.top[4], view.top[5], view.top[7]]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect([view.top[0], view.top[2], view.top[6], view.top[8]]).toEqual(['U', 'U', 'U', 'U']);
    // The side strips carry the colours a corner swap is recognised by.
    expect(view.front).toEqual(['F', null, 'R']);
  });

  it('shows edge colours alone for the second look at permutation', () => {
    const view = lastLayerView(after('M2 U M2 U2 M2 U M2'), 'edges');

    expect([view.top[0], view.top[2], view.top[6], view.top[8]]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(view.front).toEqual([null, 'B', null]);
  });
});

describe('permutationArrows', () => {
  it('finds nothing on a solved last layer', () => {
    expect(permutationArrows(solvedState())).toEqual([]);
  });

  it('marks a swap once, not twice', () => {
    // A T perm swaps two corners and two edges.
    const arrows = permutationArrows(after("R U R' U' R' F R2 U' R' U' R U R' F'"));

    expect(arrows).toHaveLength(2);
    expect(arrows.every((arrow) => arrow.isSwap)).toBe(true);
  });

  it('follows a three-cycle round', () => {
    // Ua perm cycles three edges, so each one points at the next.
    const arrows = permutationArrows(after('M2 U M U2 M\' U M2'), 'edges');

    expect(arrows).toHaveLength(3);
    expect(arrows.some((arrow) => arrow.isSwap)).toBe(false);
    // Every arrow starts where another one ends: a closed cycle.
    const starts = new Set(arrows.map((arrow) => arrow.from));
    expect(arrows.every((arrow) => starts.has(arrow.to))).toBe(true);
  });

  it('shows only the pieces the stickering is about', () => {
    const state = after("R U R' U' R' F R2 U' R' U' R U R' F'");

    expect(permutationArrows(state, 'corners').every((arrow) => arrow.from % 2 === 0)).toBe(true);
    expect(permutationArrows(state, 'edges').every((arrow) => arrow.from % 2 === 1)).toBe(true);
    expect(permutationArrows(state, 'orientation')).toEqual([]);
  });
});

describe('isometricView', () => {
  it('shows the three faces a cuber looks at', () => {
    const view = isometricView(solvedState());

    expect(view.top.every((sticker) => sticker === 'U')).toBe(true);
    expect(view.front.every((sticker) => sticker === 'F')).toBe(true);
    expect(view.right.every((sticker) => sticker === 'R')).toBe(true);
  });

  it('follows a pair into the slot', () => {
    // The pair inserted by the sexy move leaves the front-right slot filled
    // with front and right colours again.
    const view = isometricView(after("R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'"));

    expect(view.front.every((sticker) => sticker === 'F')).toBe(true);
    expect(view.right.every((sticker) => sticker === 'R')).toBe(true);
  });
});

describe('the blank stickering', () => {
  it('draws every sticker grey, whatever the state', () => {
    const view = isometricView(after("R U R' U'"), 'blank');

    expect([...view.top, ...view.front, ...view.right].every((sticker) => sticker === null)).toBe(true);
  });
});

describe('the cross stickering', () => {
  it('shows the four bottom edges and every centre, and nothing else', () => {
    const view = netView(solvedState(), 'cross');

    // Down: the cross itself — centre and edges in colour, corners grey.
    expect(view.down).toEqual(['.', 'D', '.', 'D', 'D', 'D', '.', 'D', '.'].map(dotToNull));
    // A side face: its centre, so the edge under it has something to match,
    // and the one cross sticker reaching up onto it.
    expect(view.front).toEqual(['.', '.', '.', '.', 'F', '.', '.', 'F', '.'].map(dotToNull));
    expect(view.up).toEqual(['.', '.', '.', '.', 'U', '.', '.', '.', '.'].map(dotToNull));
  });

  it('follows an edge out of the cross', () => {
    // The front edge lifted out of the cross and left in the top layer: it is
    // still drawn, and the hole it left is not.
    const view = netView(after("F2"), 'cross');

    expect(view.down[1]).toBeNull();
    expect(view.up[7]).toBe('D');
  });
});

describe('the bottom-layer stickering', () => {
  it('draws the layer being built and leaves the rest grey', () => {
    const view = netView(solvedState(), 'bottomLayer');

    expect(view.down.every((sticker) => sticker === 'D')).toBe(true);
    // A side face keeps its centre, so the corner has something to be placed
    // against, plus the bottom row that belongs to the layer.
    expect(view.front).toEqual(['.', '.', '.', '.', 'F', '.', 'F', 'F', 'F'].map(dotToNull));
    expect(view.up).toEqual(['.', '.', '.', '.', 'U', '.', '.', '.', '.'].map(dotToNull));
  });

  it('follows the corner being put in, and nothing else that has moved', () => {
    // The corner lifted out of the bottom layer by the first algorithm of the
    // step: it is drawn up in the top layer, and the middle-layer edge that
    // came out with it is not.
    const view = netView(after("R U' R'"), 'bottomLayer');

    expect(view.up.filter((sticker) => sticker !== null)).toHaveLength(2);
    expect(view.front[5]).toBeNull();
  });
});

describe('judging Roux corners', () => {
  const turned = (text: string) => {
    const parsed = parseAlg(text);
    if (!parsed.ok) throw new Error(text);
    return applyAlg(solvedState(), parsed.moves);
  };

  it.each([
    ['the middle slice turned', 'M'],
    ['the last six edges stirred', "M' U2 M U2 M2"],
    ['a case met in other colours', 'y'],
    ['other colours and a turned slice', "y M2 U2 M U2"],
  ])('counts %s as done', (_label, alg) => {
    expect(isSolvedAsShown(turned(alg), 'blocksAndCorners')).toBe(true);
  });

  it.each([
    ['two top corners swapped', "R U R' F' R U R' U' R' F R2 U' R' U'"],
    ['a block broken', "R U R'"],
    ['the top turned a quarter', 'U'],
  ])('does not count %s', (_label, alg) => {
    expect(isSolvedAsShown(turned(alg), 'blocksAndCorners')).toBe(false);
  });
});
