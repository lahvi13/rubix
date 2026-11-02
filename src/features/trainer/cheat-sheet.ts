import type { Stickering } from '../../domain/cube/views';
import {
  PAPER_SKIN,
  PAPER_SKIN_ORIENTATION,
  PAPER_SKIN_PERMUTATION,
  type CubeSkin,
} from '../../lib/cube-skins';

/**
 * One block of a printed sheet: a group of cases as the trainer groups them.
 */
export interface SheetSection {
  setId: string;
  /** The group as the pack has it; the key the cases are found by. */
  group: string;
  /**
   * The heading as the pack has it, translated when drawn. A two-look sheet
   * holds two sets, and says which one each look belongs to.
   */
  heading: readonly string[];
}

/**
 * The sheets there are: OLL and PLL in full, and the two-look route through
 * both, which is printed whole from either of its sets — it is the beginner's
 * last layer on one page, and either half alone would leave most of the page
 * empty.
 */
export type SheetKind = 'oll' | 'pll' | '2look';

export function sheetKindOf(setId: string | null): SheetKind | null {
  if (setId === 'oll' || setId === 'pll') return setId;
  if (setId === '2look-oll' || setId === '2look-pll') return '2look';
  return null;
}

export const TWO_LOOK_SECTIONS: readonly SheetSection[] = [
  { setId: '2look-oll', group: '1 / Edges', heading: ['2-Look OLL', '1 / Edges'] },
  { setId: '2look-oll', group: '2 / Corners', heading: ['2-Look OLL', '2 / Corners'] },
  { setId: '2look-pll', group: '1 / Corners', heading: ['2-Look PLL', '1 / Corners'] },
  { setId: '2look-pll', group: '2 / Edges', heading: ['2-Look PLL', '2 / Edges'] },
];

/**
 * How a case is drawn in black and white. A black-and-white printer has three
 * tones to tell stickers apart by — black, paper and a light grey — and no
 * side colours, so a picture that leans on side colours on screen leans on
 * the three tones and the arrows here.
 */
export function paperLook(setId: string, group: string): { stickering: Stickering; skin: CubeSkin } {
  if (setId === '2look-oll' && group.includes('Edges')) {
    // The edges in black and white and the corners grey: a sideways yellow on
    // an edge says which way to hold the case, and the corners do not matter
    // yet. The screen's picture leaves the edges' sides out.
    return { stickering: 'allEdges', skin: PAPER_SKIN };
  }
  if (setId === '2look-oll' || setId === 'oll') {
    return { stickering: 'orientation', skin: PAPER_SKIN_ORIENTATION };
  }
  if (setId === '2look-pll') {
    return {
      stickering: group.includes('Corners') ? 'corners' : 'edges',
      skin: PAPER_SKIN_PERMUTATION,
    };
  }
  // Full PLL: every piece in paper, and arrows for corners and edges alike —
  // without the side colours, the arrows are what tells a case apart.
  return { stickering: 'full', skin: PAPER_SKIN_PERMUTATION };
}

/**
 * Columns across the page: four for a two-look sheet or full PLL, six for the
 * fifty-seven cases of OLL, which at four would be read at the end of the nose.
 */
export function sheetColumns(caseCount: number): 4 | 6 {
  return caseCount > 24 ? 6 : 4;
}

/** A line of groups as the one-page sheet lays it out, measured. */
export interface SheetLine {
  /** The index of the first group on the line. */
  firstSection: number;
  top: number;
  bottom: number;
}

/**
 * Where a sheet too long for one page is cut in two: at the start of the line
 * that leaves the taller page shortest. Measured lines rather than counted
 * cases — a group of eight alone on its lines takes the room of twelve, and
 * an algorithm in three lines the room of two in one; cut by case count, OLL
 * came out at seven points on one page and nine on the other. Null when there
 * is only one line to cut.
 */
export function bestCut(lines: readonly SheetLine[]): number | null {
  const first = lines[0];
  const last = lines[lines.length - 1];
  if (first === undefined || last === undefined || lines.length < 2) return null;

  let best: number | null = null;
  let bestHeight = Infinity;
  for (let index = 1; index < lines.length; index++) {
    const before = lines[index - 1];
    const at = lines[index];
    if (before === undefined || at === undefined) continue;
    const height = Math.max(before.bottom - first.top, last.bottom - at.top);
    if (height < bestHeight) {
      best = at.firstSection;
      bestHeight = height;
    }
  }
  return best;
}

/** The sheet on one page, or on two cut before the group `cutAt`. */
export function sheetPages<T>(sections: readonly T[], cutAt: number | null): T[][] {
  if (cutAt === null || cutAt <= 0 || cutAt >= sections.length) return [[...sections]];
  return [sections.slice(0, cutAt), sections.slice(cutAt)];
}

/**
 * Type sizes the sheet may be set in, in points. Under the split size one
 * page would be read with the sheet held at the end of the nose, and two
 * pages read better than that.
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
