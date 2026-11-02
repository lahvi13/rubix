import type { Stickering } from '../../domain/cube/views';
import {
  PAPER_SKIN,
  PAPER_SKIN_ORIENTATION,
  PAPER_SKIN_PERMUTATION,
  type CubeSkin,
} from '../../lib/cube-skins';

/**
 * One block of the printed two-look sheet: a look at OLL or PLL, as the
 * trainer groups it.
 */
export interface SheetSection {
  setId: '2look-oll' | '2look-pll';
  /** The set's name as the pack has it, translated when drawn. */
  setName: string;
  /** The group as the pack has it; the key the cases are found by. */
  group: string;
  /**
   * What the paper picture shows, which is not always what the screen's does.
   * Black and white has no side colours to tell pieces apart by, so a picture
   * that leans on them on screen leans on the three paper tones here.
   */
  stickering: Stickering;
  skin: CubeSkin;
}

export const SHEET_SECTIONS: readonly SheetSection[] = [
  {
    setId: '2look-oll',
    setName: '2-Look OLL',
    group: '1 / Edges',
    // The edges in black and white and the corners grey: a sideways yellow
    // on an edge says which way to hold the case, and the corners do not
    // matter yet. The screen's picture leaves the edges' sides out.
    stickering: 'allEdges',
    skin: PAPER_SKIN,
  },
  {
    setId: '2look-oll',
    setName: '2-Look OLL',
    group: '2 / Corners',
    stickering: 'orientation',
    skin: PAPER_SKIN_ORIENTATION,
  },
  {
    setId: '2look-pll',
    setName: '2-Look PLL',
    group: '1 / Corners',
    stickering: 'corners',
    skin: PAPER_SKIN_PERMUTATION,
  },
  {
    setId: '2look-pll',
    setName: '2-Look PLL',
    group: '2 / Edges',
    stickering: 'edges',
    skin: PAPER_SKIN_PERMUTATION,
  },
];

/** The sheet on one page, or OLL and PLL on a page each. */
export function sheetPages(isSplit: boolean): SheetSection[][] {
  if (!isSplit) return [[...SHEET_SECTIONS]];
  return ['2look-oll', '2look-pll'].map((setId) =>
    SHEET_SECTIONS.filter((section) => section.setId === setId),
  );
}

/**
 * Type sizes the sheet may be set in, in points. Under the split size one
 * page would be read with the sheet held at the end of the nose, and two
 * pages of OLL and PLL read better than that.
 */
export const SHEET_TYPE = { minPt: 6, maxPt: 13, stepPt: 0.25, splitBelowPt: 8 } as const;

/**
 * The largest size, on the step, at which the page still fits — or the
 * smallest there is when none does, since a sheet has to be set in something.
 * Halved rather than walked: every try lays the page out again.
 */
export function largestFitting(
  fits: (pt: number) => boolean,
  { minPt, maxPt, stepPt }: { minPt: number; maxPt: number; stepPt: number },
): number {
  let low = 0;
  let high = Math.round((maxPt - minPt) / stepPt);
  if (!fits(minPt)) return minPt;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(minPt + middle * stepPt)) low = middle;
    else high = middle - 1;
  }
  return minPt + low * stepPt;
}
