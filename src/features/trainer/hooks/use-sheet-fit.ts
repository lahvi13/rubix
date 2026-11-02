import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { bestCuts, largestFitting, SHEET_TYPE, type SheetLine } from '../cheat-sheet';

/** CSS millimetres are exact: 96 pixels to the inch. */
const PX_PER_MM = 96 / 25.4;

/** A4, and the margin `@page` prints it with (cheat-sheet.css). */
const PAGE_WIDTH_MM = 210;
const MARGIN_MM = 10;

/**
 * The height the content may take, a few millimetres short of the paper's: the
 * page is measured on screen and printed by the print engine, and a line that
 * comes out a hair taller there must not push the last row onto a second page.
 */
const CONTENT_HEIGHT_PX = (297 - 2 * MARGIN_MM - 4) * PX_PER_MM;

/**
 * Sets the sheet in the largest type that keeps each of its pages on a sheet
 * of paper — one size for all of them — and scales the pages down to the
 * width of the screen. Hands back the groups the sheet is cut into pages
 * before, none while it fits one.
 *
 * Measured rather than estimated: how many lines an algorithm takes depends on
 * where its triggers break, and that is the browser's to know. The size is set
 * on the page directly, before the browser paints — a size in React state
 * would paint the page once at the wrong size first.
 *
 * `contentKey` names what is on the sheet. A different algorithm may fit where
 * the last one did not, so a sheet once split is tried on one page again.
 */
export function useSheetFit(frame: RefObject<HTMLElement | null>, contentKey: string): readonly number[] {
  const [split, setSplit] = useState<SheetSplit>({ key: contentKey, cuts: NO_CUTS, lines: NO_LINES });
  const isCurrent = split.key === contentKey;
  const cuts = isCurrent ? split.cuts : NO_CUTS;
  const lines = isCurrent ? split.lines : NO_LINES;
  // The type is measured in the font it is drawn in; one still loading would
  // be measured in its fallback.
  const [fontsLoaded, setFontsLoaded] = useState(0);

  useEffect(() => {
    let isLive = true;
    void document.fonts?.ready.then(() => {
      if (isLive) setFontsLoaded((count) => count + 1);
    });
    return () => {
      isLive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const root = frame.current;
    if (!root) return;

    const pages = [...root.querySelectorAll<HTMLElement>('.cheat-sheet__page')];
    const sizes = pages.flatMap((page) => {
      const content = page.querySelector<HTMLElement>('.cheat-sheet__content');
      if (!content) return [];
      return [
        largestFitting((pt) => {
          page.style.setProperty('--sheet-pt', `${pt}pt`);
          return content.offsetHeight <= CONTENT_HEIGHT_PX;
        }, SHEET_TYPE),
      ];
    });
    if (sizes.length === 0) return;

    // Every page in the type of the tightest one. A size per page drew the
    // same cube at two sizes on two pages of one sheet, and the pages read as
    // two different prints.
    const shared = Math.min(...sizes);
    for (const page of pages) page.style.setProperty('--sheet-pt', `${shared}pt`);
    if (shared >= SHEET_TYPE.splitBelowPt) return;

    // Too small: one page more, the lines spread over all of them afresh.
    // The lines are those of the sheet on one page, measured once — on it
    // every group stands where it would on any page that starts a line.
    const measured = cuts.length === 0 ? linesOf(pages[0]) : lines;
    const next = bestCuts(measured, cuts.length + 2);
    // Known only once the page is laid out. There are only so many lines to
    // cut between, so the cutting comes to an end.
    // oxlint-disable-next-line react/set-state-in-effect
    if (next.length > 0) setSplit({ key: contentKey, cuts: next, lines: measured });
  }, [frame, contentKey, cuts, lines, fontsLoaded]);

  useLayoutEffect(() => {
    const root = frame.current;
    if (!root) return;
    const fit = () => {
      const style = getComputedStyle(root);
      const width =
        root.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
      const scale = Math.min(1, width / (PAGE_WIDTH_MM * PX_PER_MM));
      root.style.setProperty('--sheet-scale', String(scale));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [frame]);

  return cuts;
}

interface SheetSplit {
  key: string;
  cuts: readonly number[];
  /** The lines of the sheet laid out on one page, which the cuts are made between. */
  lines: readonly SheetLine[];
}

const NO_CUTS: readonly number[] = [];
const NO_LINES: readonly SheetLine[] = [];

/** The lines a page's groups are laid out in, top to bottom. */
function linesOf(page: HTMLElement | undefined): SheetLine[] {
  const lines: SheetLine[] = [];
  page?.querySelectorAll<HTMLElement>('.cheat-sheet__section').forEach((section, index) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const line = lines[lines.length - 1];
    if (line !== undefined && line.top === top) line.bottom = Math.max(line.bottom, bottom);
    else lines.push({ firstSection: index, top, bottom });
  });
  return lines;
}
