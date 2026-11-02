import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { bestCut, largestFitting, SHEET_TYPE, type SheetLine } from '../cheat-sheet';

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
 * Sets every page of the sheet in the largest type that keeps it on its sheet
 * of paper, and scales the pages down to the width of the screen. Hands back
 * the group the sheet is cut in two before, or null while it fits one page.
 *
 * Measured rather than estimated: how many lines an algorithm takes depends on
 * where its triggers break, and that is the browser's to know. The size is set
 * on the page directly, before the browser paints — a size in React state
 * would paint the page once at the wrong size first.
 *
 * `contentKey` names what is on the sheet. A different algorithm may fit where
 * the last one did not, so a sheet once split is tried on one page again.
 */
export function useSheetFit(frame: RefObject<HTMLElement | null>, contentKey: string): number | null {
  const [split, setSplit] = useState<{ key: string; cutAt: number | null }>({ key: contentKey, cutAt: null });
  const cutAt = split.key === contentKey ? split.cutAt : null;
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

    const sizes = [...root.querySelectorAll<HTMLElement>('.cheat-sheet__page')].map((page) => {
      const content = page.querySelector<HTMLElement>('.cheat-sheet__content');
      if (!content) return SHEET_TYPE.maxPt;
      const best = largestFitting((pt) => {
        page.style.setProperty('--sheet-pt', `${pt}pt`);
        return content.offsetHeight <= CONTENT_HEIGHT_PX;
      }, SHEET_TYPE);
      page.style.setProperty('--sheet-pt', `${best}pt`);
      return best;
    });

    if (cutAt === null && sizes.some((pt) => pt < SHEET_TYPE.splitBelowPt)) {
      const cut = bestCut(linesOf(root));
      // Known only once the page is laid out, and then at most once per
      // content: the split pages are measured, never split again.
      // oxlint-disable-next-line react/set-state-in-effect
      if (cut !== null) setSplit({ key: contentKey, cutAt: cut });
    }
  }, [frame, contentKey, cutAt, fontsLoaded]);

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

  return cutAt;
}

/** The lines the groups of a one-page sheet are laid out in, top to bottom. */
function linesOf(root: HTMLElement): SheetLine[] {
  const lines: SheetLine[] = [];
  root.querySelectorAll<HTMLElement>('.cheat-sheet__section').forEach((section, index) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    const line = lines[lines.length - 1];
    if (line !== undefined && line.top === top) line.bottom = Math.max(line.bottom, bottom);
    else lines.push({ firstSection: index, top, bottom });
  });
  return lines;
}
