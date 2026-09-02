import { describe, expect, it } from 'vitest';
import { parseAlg, type Move } from './notation';
import { applyAlg, solvedState } from './state';
import { isometricView, lastLayerView } from './views';

function alg(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`bad test alg: ${text}`);
  return parsed.moves;
}

const after = (text: string) => applyAlg(solvedState(), alg(text));

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

describe('pair stickering', () => {
  it('shows the front-right pair and nothing else', () => {
    // Pair still in the slot: five stickers belong to it, the corner's three
    // and the edge's two.
    const view = isometricView(solvedState(), 'pair');
    const shown = [...view.top, ...view.front, ...view.right].filter((cell) => cell !== null);

    // Two of the corner's stickers and one of the edge's face the viewer.
    expect(shown).toEqual(['F', 'F', 'R', 'R']);
  });

  it('follows the pair when the algorithm takes it out of the slot', () => {
    const view = isometricView(after("R U R'"), 'pair');

    expect(view.top.some((cell) => cell !== null)).toBe(true);
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
