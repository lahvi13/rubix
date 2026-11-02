import { describe, expect, it } from 'vitest';
import { PACKS } from '../../db/seed/packs';
import { largestFitting, sheetPages, SHEET_SECTIONS, SHEET_TYPE } from './cheat-sheet';

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

describe('sheetPages', () => {
  it('keeps every section on one page', () => {
    expect(sheetPages(false)).toEqual([SHEET_SECTIONS]);
  });

  it('splits OLL from PLL', () => {
    const pages = sheetPages(true);
    expect(pages.map((page) => page.map((section) => section.setId))).toEqual([
      ['2look-oll', '2look-oll'],
      ['2look-pll', '2look-pll'],
    ]);
  });
});

describe('SHEET_SECTIONS', () => {
  // The groups are keys into the packs: a renamed group would leave its
  // section empty on paper without a word.
  it.each(SHEET_SECTIONS)('$setId has the group $group', ({ setId, setName, group }) => {
    const pack = PACKS.find((candidate) => candidate.set.id === setId);
    expect(pack?.set.name).toBe(setName);
    expect(pack?.cases.some((entry) => entry.group === group)).toBe(true);
  });

  it('covers every group of both sets', () => {
    for (const setId of ['2look-oll', '2look-pll']) {
      const groups = new Set(PACKS.find((pack) => pack.set.id === setId)?.cases.map((entry) => entry.group));
      const drawn = new Set(SHEET_SECTIONS.filter((section) => section.setId === setId).map((section) => section.group));
      expect(drawn).toEqual(groups);
    }
  });
});
