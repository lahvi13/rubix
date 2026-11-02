import { describe, expect, it } from 'vitest';
import { PACKS } from '../../db/seed/packs';
import {
  largestFitting,
  paperLook,
  sheetColumns,
  sheetKindOf,
  sheetPages,
  bestCut,
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
    // Sets read by their colours have no sheet.
    { setId: 'f2l', kind: null },
    { setId: 'cmll', kind: null },
    { setId: null, kind: null },
  ])('$setId prints as $kind', ({ setId, kind }) => {
    expect(sheetKindOf(setId)).toBe(kind);
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
    { cutAt: null, pages: [[0, 1, 2, 3]] },
    { cutAt: 2, pages: [[0, 1], [2, 3]] },
    // A cut at either end is no cut.
    { cutAt: 0, pages: [[0, 1, 2, 3]] },
    { cutAt: 4, pages: [[0, 1, 2, 3]] },
  ])('cut at $cutAt', ({ cutAt, pages }) => {
    expect(sheetPages([0, 1, 2, 3], cutAt)).toEqual(pages);
  });
});

describe('bestCut', () => {
  const line = (firstSection: number, top: number, bottom: number) => ({ firstSection, top, bottom });

  it('cuts where the taller page is shortest, not where the cases halve', () => {
    // Two tall lines first, three short ones after: the cut goes after the
    // second line, though most cases come after it.
    const lines = [line(0, 0, 40), line(1, 45, 85), line(3, 90, 110), line(5, 115, 135), line(8, 140, 160)];
    expect(bestCut(lines)).toBe(3);
  });

  it('cuts two-look OLL from PLL', () => {
    const lines = [line(0, 0, 30), line(1, 35, 95), line(2, 100, 130), line(3, 135, 165)];
    expect(bestCut(lines)).toBe(2);
  });

  it.each([{ lines: [] }, { lines: [line(0, 0, 100)] }])('has nothing to cut in $lines.length lines', ({ lines }) => {
    expect(bestCut(lines)).toBeNull();
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
