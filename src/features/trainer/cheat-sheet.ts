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
 * Which sheet a set prints as: the set itself, or — for either half of the
 * two-look route through the last layer — the whole route, which is the
 * beginner's last layer on one page; either half alone would leave most of
 * the page empty.
 */
export const TWO_LOOK_SHEET = '2look';
export type SheetKind = string;

/** The cross has no cases to print, and the beginner's set belongs to its guide. */
export function sheetKindOf(setId: string | null): SheetKind | null {
  if (setId === null || setId === 'cross' || setId === 'beginner') return null;
  if (setId === '2look-oll' || setId === '2look-pll') return TWO_LOOK_SHEET;
  return setId;
}

/**
 * Sheets that only print in colour. Everything but the last layer's own sets
 * is read by side colours — an F2L pair by the faces beside its slot, a Roux
 * block by blue and green, a 2×2's PBL by both layers' sides — and in black
 * and white every case would look like the next.
 */
const PAPER_SHEETS: ReadonlySet<SheetKind> = new Set([TWO_LOOK_SHEET, 'oll', 'pll', 'pocket-oll']);

export function isColourOnly(kind: SheetKind): boolean {
  return !PAPER_SHEETS.has(kind);
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
  if (setId === '2look-oll' || setId === 'oll' || setId === 'pocket-oll') {
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
 * Where a sheet too long for one page is cut, into `pages` pages: before the
 * lines that leave the tallest page shortest. Every page is set in one size,
 * the tallest page's, so the pages are balanced against each other rather
 * than each filled in turn — cut one page at a time, full OLL came out with
 * its first page half empty. Measured lines rather than counted cases: a
 * group of eight alone on its lines takes the room of twelve, and an
 * algorithm in three lines the room of two in one. No cuts when there are
 * not enough lines to cut.
 */
export function bestCuts(lines: readonly SheetLine[], pages: number): number[] {
  const count = lines.length;
  if (pages < 2 || count < pages) return [];
  const heightOf = (from: number, to: number): number =>
    (lines[to - 1]?.bottom ?? 0) - (lines[from]?.top ?? 0);

  // tallest[k][i]: the shortest tallest page laying the first i lines on k
  // pages; cutBefore[k][i]: the line its last page starts on.
  const tallest: number[][] = [[], Array.from({ length: count + 1 }, (_, i) => heightOf(0, i))];
  const cutBefore: number[][] = [[], []];
  for (let k = 2; k <= pages; k++) {
    const previous = tallest[k - 1] ?? [];
    const row: number[] = [];
    const cutRow: number[] = [];
    for (let i = k; i <= count; i++) {
      let best = Infinity;
      for (let j = k - 1; j < i; j++) {
        const height = Math.max(previous[j] ?? Infinity, heightOf(j, i));
        if (height < best) {
          best = height;
          cutRow[i] = j;
        }
      }
      row[i] = best;
    }
    tallest.push(row);
    cutBefore.push(cutRow);
  }

  const cuts: number[] = [];
  let end = count;
  for (let k = pages; k > 1; k--) {
    const at = cutBefore[k]?.[end] ?? 0;
    cuts.unshift(lines[at]?.firstSection ?? 0);
    end = at;
  }
  return cuts;
}

/**
 * The sheet cut into pages before each group in `cuts`. A page still too
 * long once cut is cut again, so the second block of Roux — sixty-five cases
 * in groups of fourteen — goes over three pages rather than two at seven
 * points.
 */
export function sheetPages<T>(sections: readonly T[], cuts: readonly number[]): T[][] {
  const at = [...new Set(cuts)].filter((cut) => cut > 0 && cut < sections.length).sort((a, b) => a - b);
  return [0, ...at].map((start, index) => sections.slice(start, at[index] ?? sections.length));
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
