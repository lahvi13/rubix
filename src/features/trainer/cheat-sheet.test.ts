import { describe, expect, it } from 'vitest';
import { PACKS } from '../../db/seed/packs';
import {
  isColourOnly,
  largestFitting,
  paperLook,
  sheetColumns,
  sheetKindOf,
  sheetPages,
  bestCuts,
  SHEET_TYPE,
  TWO_LOOK_SECTIONS,
} from './cheat-sheet';

describe('largestFitting', () => {
  it.each([
    { limit: 13, expected: 13 },
    { limit: 20, expected: 13 },
    { limit: 9.6, expected: 9.5 },
    { limit: 6, expected: 6 },
    // Nothing fits: the smallest size, not nothing.
    { limit: 3, expected: 6 },
  ])('fits up to $limit pt as $expected pt', ({ limit, expected }) => {
    expect(largestFitting((pt) => pt <= limit, SHEET_TYPE)).toBe(expected);
  });

  it('lays the page out a handful of times, not once per step', () => {
    let tries = 0;
    largestFitting((pt) => {
      tries++;
      return pt <= 10;
    }, SHEET_TYPE);
    expect(tries).toBeLessThanOrEqual(7);
  });
});

describe('sheetKindOf', () => {
  it.each([
    { setId: 'oll', kind: 'oll' },
    { setId: 'pll', kind: 'pll' },
    // Either half of the two-look route prints the whole of it.
    { setId: '2look-oll', kind: '2look' },
    { setId: '2look-pll', kind: '2look' },
    { setId: 'f2l-advanced', kind: 'f2l-advanced' },
    { setId: 'cmll', kind: 'cmll' },
    { setId: 'pocket-pbl', kind: 'pocket-pbl' },
    // Nothing to print, or not the trainer's to print.
    { setId: 'cross', kind: null },
    { setId: 'beginner', kind: null },
    { setId: null, kind: null },
  ])('$setId prints as $kind', ({ setId, kind }) => {
    expect(sheetKindOf(setId)).toBe(kind);
  });
});

describe('isColourOnly', () => {
  it.each([
    { kind: '2look', expected: false },
    { kind: 'oll', expected: false },
    { kind: 'pll', expected: false },
    { kind: 'f2l', expected: true },
    { kind: 'roux-sb', expected: true },
    { kind: 'cmll', expected: true },
    // The 2×2's OLL is read by its yellow alone; its PBL by both layers' sides.
    { kind: 'pocket-oll', expected: false },
    { kind: 'pocket-pbl', expected: true },
  ])('$kind: $expected', ({ kind, expected }) => {
    expect(isColourOnly(kind)).toBe(expected);
  });
});

describe('sheetColumns', () => {
  it.each([
    { cases: 16, columns: 4 },
    { cases: 21, columns: 4 },
    { cases: 57, columns: 6 },
  ])('$cases cases go $columns across', ({ cases, columns }) => {
    expect(sheetColumns(cases)).toBe(columns);
  });
});

describe('sheetPages', () => {
  it.each([
    { cuts: [], pages: [[0, 1, 2, 3]] },
    { cuts: [2], pages: [[0, 1], [2, 3]] },
    { cuts: [3, 1], pages: [[0], [1, 2], [3]] },
    // A cut at either end, or twice in one place, is no cut.
    { cuts: [0, 4], pages: [[0, 1, 2, 3]] },
    { cuts: [2, 2], pages: [[0, 1], [2, 3]] },
  ])('cut at $cuts', ({ cuts, pages }) => {
    expect(sheetPages([0, 1, 2, 3], cuts)).toEqual(pages);
  });
});

describe('bestCuts', () => {
  const line = (firstSection: number, top: number, bottom: number) => ({ firstSection, top, bottom });

  it('cuts where the taller page is shortest, not where the cases halve', () => {
    // Two tall lines first, three short ones after: the cut goes after the
    // second line, though most cases come after it.
    const lines = [line(0, 0, 40), line(1, 45, 85), line(3, 90, 110), line(5, 115, 135), line(8, 140, 160)];
    expect(bestCuts(lines, 2)).toEqual([3]);
  });

  it('cuts two-look OLL from PLL', () => {
    const lines = [line(0, 0, 30), line(1, 35, 95), line(2, 100, 130), line(3, 135, 165)];
    expect(bestCuts(lines, 2)).toEqual([2]);
  });

  it('spreads three pages evenly rather than cutting the fullest one again', () => {
    // Six lines of 20 with gaps of 5: two lines to a page.
    const lines = [0, 1, 2, 3, 4, 5].map((index) => line(index * 2, index * 25, index * 25 + 20));
    expect(bestCuts(lines, 3)).toEqual([4, 8]);
  });

  it.each([
    { lines: [], pages: 2 },
    { lines: [line(0, 0, 100)], pages: 2 },
    { lines: [line(0, 0, 40), line(1, 45, 85)], pages: 3 },
    { lines: [line(0, 0, 40), line(1, 45, 85)], pages: 1 },
  ])('has nothing to cut in $lines.length lines over $pages pages', ({ lines, pages }) => {
    expect(bestCuts(lines, pages)).toEqual([]);
  });
});

describe('TWO_LOOK_SECTIONS', () => {
  // The groups are keys into the packs: a renamed group would leave its
  // section empty on paper without a word.
  it.each(TWO_LOOK_SECTIONS)('$setId has the group $group', ({ setId, group, heading }) => {
    const pack = PACKS.find((candidate) => candidate.set.id === setId);
    expect(pack?.set.name).toBe(heading[0]);
    expect(pack?.cases.some((entry) => entry.group === group)).toBe(true);
  });

  it('covers every group of both sets', () => {
    for (const setId of ['2look-oll', '2look-pll']) {
      const groups = new Set(PACKS.find((pack) => pack.set.id === setId)?.cases.map((entry) => entry.group));
      const drawn = new Set(TWO_LOOK_SECTIONS.filter((section) => section.setId === setId).map((section) => section.group));
      expect(drawn).toEqual(groups);
    }
  });
});

describe('paperLook', () => {
  it.each([
    { setId: '2look-oll', group: '1 / Edges', stickering: 'allEdges' },
    { setId: '2look-oll', group: '2 / Corners', stickering: 'orientation' },
    { setId: 'oll', group: 'Dot', stickering: 'orientation' },
    { setId: 'pocket-oll', group: 'Sune', stickering: 'orientation' },
    { setId: '2look-pll', group: '1 / Corners', stickering: 'corners' },
    { setId: '2look-pll', group: '2 / Edges', stickering: 'edges' },
    { setId: 'pll', group: 'Adjacent corner swap', stickering: 'full' },
  ])('$setId $group is drawn as $stickering', ({ setId, group, stickering }) => {
    expect(paperLook(setId, group).stickering).toBe(stickering);
  });

  it('never draws a permutation case with a black top under its black arrows', () => {
    for (const [setId, group] of [['2look-pll', '1 / Corners'], ['pll', 'Edges only']] as const) {
      const { skin } = paperLook(setId, group);
      expect(skin.faces.U).not.toBe(skin.arrow.fill);
    }
  });
});
