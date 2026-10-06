import { describe, expect, it } from 'vitest';
import {
  maskHidingLayer,
  maskHidingLayerPieces,
  maskKeepingLayer,
  maskOrientingLayer,
  type StickeringMask,
} from './twisty-stickering';

/** How many pieces of each kind are drawn wholly in colour, wholly grey, or partly. */
function census(mask: StickeringMask) {
  return Object.fromEntries(
    Object.entries(mask.orbits).map(([orbit, { pieces }]) => {
      const kinds = pieces.map(({ facelets }) =>
        facelets.every((paint) => paint === 'regular')
          ? 'colour'
          : facelets.every((paint) => paint === 'ignored')
            ? 'grey'
            : 'partly',
      );
      return [
        orbit,
        {
          colour: kinds.filter((kind) => kind === 'colour').length,
          grey: kinds.filter((kind) => kind === 'grey').length,
          partly: kinds.filter((kind) => kind === 'partly').length,
        },
      ];
    }),
  );
}

describe('player masks', () => {
  it('greys one layer and leaves the rest', async () => {
    expect(census(await maskHidingLayer('D'))).toEqual({
      EDGES: { colour: 8, grey: 4, partly: 0 },
      CORNERS: { colour: 4, grey: 4, partly: 0 },
      CENTERS: { colour: 5, grey: 1, partly: 0 },
    });
  });

  it('keeps only the top colour of a layer', async () => {
    expect(census(await maskOrientingLayer('D'))).toEqual({
      EDGES: { colour: 8, grey: 0, partly: 4 },
      CORNERS: { colour: 4, grey: 0, partly: 4 },
      // A centre has one sticker; its other orientations are not stickers.
      CENTERS: { colour: 5, grey: 0, partly: 1 },
    });
  });

  // The first look at OLL: the edges' yellow, the corners of that layer grey.
  it('keeps only the top colour of the edges when asked', async () => {
    expect(census(await maskOrientingLayer('D', 'EDGES'))).toEqual({
      EDGES: { colour: 8, grey: 0, partly: 4 },
      CORNERS: { colour: 4, grey: 4, partly: 0 },
      CENTERS: { colour: 5, grey: 0, partly: 1 },
    });
  });

  // The beginner's bottom layer: its eight pieces and every centre, nothing of
  // the middle layer or the last.
  it('keeps one layer and the centres, and greys everything else', async () => {
    expect(census(await maskKeepingLayer('U'))).toEqual({
      EDGES: { colour: 4, grey: 8, partly: 0 },
      CORNERS: { colour: 4, grey: 4, partly: 0 },
      CENTERS: { colour: 6, grey: 0, partly: 0 },
    });
  });

  // The cross: the four edges of that layer and the centres they are matched against.
  it('keeps only the edges of a layer when asked', async () => {
    expect(census(await maskKeepingLayer('U', 'EDGES'))).toEqual({
      EDGES: { colour: 4, grey: 8, partly: 0 },
      CORNERS: { colour: 0, grey: 8, partly: 0 },
      CENTERS: { colour: 6, grey: 0, partly: 0 },
    });
  });

  it.each([
    ['EDGES', { EDGES: { colour: 8, grey: 4, partly: 0 }, CORNERS: { colour: 8, grey: 0, partly: 0 } }],
    ['CORNERS', { EDGES: { colour: 12, grey: 0, partly: 0 }, CORNERS: { colour: 4, grey: 4, partly: 0 } }],
  ] as const)('greys only the %s of the last layer', async (kind, expected) => {
    const result = census(await maskHidingLayerPieces('D', kind));
    expect(result.EDGES).toEqual(expected.EDGES);
    expect(result.CORNERS).toEqual(expected.CORNERS);
    expect(result.CENTERS).toEqual({ colour: 6, grey: 0, partly: 0 });
  });
});
