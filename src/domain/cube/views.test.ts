import { describe, expect, it } from 'vitest';
import { invertAlg, parseAlg, type Move } from './notation';
import { applyAlg, solvedState } from './state';
import { isSolvedAsShown, isometricView, lastLayerView, netView, permutationArrows } from './views';

function alg(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`bad test alg: ${text}`);
  return parsed.moves;
}

const after = (text: string) => applyAlg(solvedState(), alg(text));

const inverseOf = (move: Move): Move => invertAlg([move])[0] ?? move;

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

describe('permutation arrows on a cube drawn turned', () => {
  it('point the same way whichever side is in front', () => {
    // Roux's corner sets are drawn a quarter turn round, blue on the left. The
    // same two corners are swapped; before the arrows were read against the
    // cube's own centres they came out as a tangle of three.
    const jb = "R U R' F' R U R' U' R' F R2 U' R' U'";
    const undone = (turn: string) =>
      applyAlg(solvedState(), [...alg(turn), ...alg(jb).reverse().map(inverseOf)]);

    const straight = permutationArrows(undone(''), 'corners');
    expect(straight).toHaveLength(1);
    expect(straight[0]?.isSwap).toBe(true);
    for (const turn of ['y', 'y2', "y'"]) {
      expect(permutationArrows(undone(turn), 'corners'), turn).toEqual(straight);
    }
  });
});

describe('the edge-orientation stickering of the last six edges', () => {
  it('flags a bad edge where a good one shows its yellow or white', () => {
    // The arrow: three bad edges on top and the front one below.
    const view = netView(after("M' U' M"), 'lseOrientation');

    // Up, row 0 at the back: the back edge is good, the other three are bad.
    expect(view.up).toEqual(['.', 'U', '.', 'marked', 'U', 'marked', '.', 'marked', '.'].map(dotToNull));
    // The bad front edges show their yellow and white on the front instead.
    expect(view.front[1]).not.toBeNull();
    expect(view.front[7]).not.toBeNull();
    expect(view.down[1]).toBe('marked');
    expect(view.down[7]).toBe('D');
  });

  it('flags nothing once every edge is good, wherever the edges are', () => {
    const view = netView(after('M2 U M2 U2'), 'lseOrientation');

    expect([...view.up, ...view.down, ...view.front, ...view.right]).not.toContain('marked');
  });

  it('never flags a centre, though a turned slice puts a side colour on top', () => {
    const view = netView(after('M'), 'lseOrientation');

    expect(view.up[4]).toBeNull();
  });
});

describe('the side-edges stickering', () => {
  it('shows the two edges that go over the blocks and greys the middle slice', () => {
    const view = netView(solvedState(), 'sideEdges');

    // Up: the corners, the centre and the left and right edges; the front and
    // back ones belong to the middle slice.
    expect(view.up).toEqual(['U', '.', 'U', 'U', 'U', 'U', 'U', '.', 'U'].map(dotToNull));
    // A side face: the blocks reach across it, and the slice between them
    // keeps only its centre.
    expect(view.front).toEqual(['F', '.', 'F', 'F', 'F', 'F', 'F', '.', 'F'].map(dotToNull));
  });

  it('follows a side edge into the middle slice', () => {
    // The top turned a quarter: the edge from the left is at the back now,
    // and the one that took its place is not drawn.
    const view = netView(after('U'), 'sideEdges');

    expect(view.up[1]).toBe('U');
    expect(view.up[3]).toBeNull();
  });
});

describe("the stickerings of ZZ's first steps", () => {
  it('flags both stickers of a bad edge and draws nothing else but the centres', () => {
    // The front turned a quarter: its four edges are bad, the other eight good.
    const view = netView(after("F'"), 'badEdges');

    expect(view.front).toEqual(['.', 'marked', '.', 'marked', 'F', 'marked', '.', 'marked', '.'].map(dotToNull));
    expect(view.up).toEqual(['.', '.', '.', '.', 'U', '.', '.', 'marked', '.'].map(dotToNull));
    expect(view.down).toEqual(['.', 'marked', '.', '.', 'D', '.', '.', '.', '.'].map(dotToNull));
    expect(view.right).toEqual(['.', '.', '.', 'marked', 'R', '.', '.', '.', '.'].map(dotToNull));
    expect(view.left).toEqual(['.', '.', '.', '.', 'L', 'marked', '.', '.', '.'].map(dotToNull));
    expect(view.back).toEqual(['.', '.', '.', '.', 'B', '.', '.', '.', '.'].map(dotToNull));
  });

  it('flags nothing after turns that turn no edge over', () => {
    const view = netView(after("R U2 L' D F2 U' B2 R2"), 'badEdges');
    const cells = [view.up, view.left, view.front, view.right, view.back, view.down].flat();

    expect(cells).not.toContain('marked');
    expect(cells.filter((cell) => cell !== null)).toHaveLength(6);
  });

  it('draws the one sticker each edge is read by, in a top or bottom colour', () => {
    const view = isometricView(solvedState(), 'readsPole');

    // The top's four edges, the top colour on the right half and towards the
    // front; the front's two beside the centre; nothing on the side.
    expect(view.top).toEqual(['.', 'D', '.', 'D', 'U', 'U', '.', 'U', '.'].map(dotToNull));
    expect(view.front).toEqual(['.', '.', '.', 'D', 'F', 'U', '.', '.', '.'].map(dotToNull));
    expect(view.right).toEqual(['.', '.', '.', '.', 'R', '.', '.', '.', '.'].map(dotToNull));
  });

  it('draws the same places in a left or right colour', () => {
    const view = isometricView(solvedState(), 'readsSide');

    expect(view.top).toEqual(['.', 'L', '.', 'L', 'U', 'R', '.', 'R', '.'].map(dotToNull));
    expect(view.front).toEqual(['.', '.', '.', 'L', 'F', 'R', '.', '.', '.'].map(dotToNull));
    expect(view.right).toEqual(['.', '.', '.', '.', 'R', '.', '.', '.', '.'].map(dotToNull));
  });

  it('draws a front or back colour with the other sticker of the edge beside it', () => {
    const view = isometricView(solvedState(), 'readsFront');

    // Only the three edges with both stickers in sight: top front, top
    // right, front right. The sticker read, then the other one in a top or
    // bottom colour — the bad edge.
    expect(view.top).toEqual(['.', '.', '.', '.', 'U', 'B', '.', 'F', '.'].map(dotToNull));
    expect(view.front).toEqual(['.', 'U', '.', '.', 'F', 'F', '.', '.', '.'].map(dotToNull));
    expect(view.right).toEqual(['.', 'U', '.', 'D', 'R', '.', '.', '.', '.'].map(dotToNull));
  });

  it('reads the same twelve places in both pictures that settle an edge at a glance', () => {
    const state = after("F' L' D U2 L B' D");
    const cells = (stickering: 'readsPole' | 'readsSide' | 'readsFront') => {
      const view = netView(state, stickering);
      return [view.up, view.left, view.front, view.right, view.back, view.down].flat();
    };
    const pole = cells('readsPole');
    const side = cells('readsSide');
    // On a face of nine, the edges are the odd cells.
    const isEdge = (at: number) => (at % 9) % 2 === 1;

    for (const at of pole.keys()) {
      if (isEdge(at)) expect(side[at] !== null).toBe(pole[at] !== null);
    }
    expect(pole.filter((cell, at) => isEdge(at) && cell !== null)).toHaveLength(12);
    // Where the second sticker decides, an edge is drawn whole or not at
    // all: three edges, two stickers each.
    expect(cells('readsFront').filter((cell, at) => isEdge(at) && cell !== null)).toHaveLength(6);
  });

  it('leaves on a cube only what the rules read off it', () => {
    const view = netView(solvedState(), 'edgeReading');

    // Top and bottom: all four edges, each settled at a glance.
    expect(view.up).toEqual(['.', 'U', '.', 'U', 'U', 'U', '.', 'U', '.'].map(dotToNull));
    expect(view.down).toEqual(['.', 'D', '.', 'D', 'D', 'D', '.', 'D', '.'].map(dotToNull));
    // Front and back: the two beside the centre. They show a front or back
    // colour, so the other sticker of each is drawn too, round on the sides.
    expect(view.front).toEqual(['.', '.', '.', 'F', 'F', 'F', '.', '.', '.'].map(dotToNull));
    expect(view.back).toEqual(['.', '.', '.', 'B', 'B', 'B', '.', '.', '.'].map(dotToNull));
    expect(view.right).toEqual(['.', '.', '.', 'R', 'R', 'R', '.', '.', '.'].map(dotToNull));
    expect(view.left).toEqual(['.', '.', '.', 'L', 'L', 'L', '.', '.', '.'].map(dotToNull));
  });

  it('draws the second sticker only beside a front or back colour', () => {
    // The top turned a quarter: its edges still show the top colour, but the
    // four of the middle layer are where they were.
    const turned = netView(after('U'), 'edgeReading');
    expect(turned.front).toEqual(['.', '.', '.', 'F', 'F', 'F', '.', '.', '.'].map(dotToNull));

    // A side turned a quarter: front and back colours come up onto the top
    // and bottom, and each brings its other sticker into the picture.
    const view = netView(after('R'), 'edgeReading');
    const cells = [view.up, view.left, view.front, view.right, view.back, view.down].flat();
    const isEdge = (at: number) => (at % 9) % 2 === 1;
    const shown = cells.filter((cell, at) => isEdge(at) && cell !== null);

    expect(shown.filter((cell) => cell === 'F' || cell === 'B')).toHaveLength(4);
    expect(shown).toHaveLength(12 + 4);
  });

  it('draws every edge and centre in colour and leaves the corners out', () => {
    const view = netView(after("F' L' D U2 L B' D"), 'allEdges');

    for (const face of [view.up, view.left, view.front, view.right, view.back, view.down]) {
      expect([0, 2, 6, 8].map((corner) => face[corner])).toEqual([null, null, null, null]);
      expect([1, 3, 4, 5, 7].map((other) => face[other])).not.toContain(null);
    }
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
