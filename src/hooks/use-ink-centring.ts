import { useLayoutEffect, type RefObject } from 'react';

let measuring: OffscreenCanvasRenderingContext2D | null | undefined;

function context(): OffscreenCanvasRenderingContext2D | null {
  if (measuring === undefined) {
    // No OffscreenCanvas under jsdom: the text is then simply left where it is.
    measuring =
      typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(1, 1).getContext('2d');
  }
  return measuring;
}

/**
 * Moves a line of text so that its drawn shapes sit on the centre, rather than
 * its character cells. A seven-segment "1" lights only the right-hand segments
 * of a cell as wide as an "8", so "14" centred by its cells sits visibly to the
 * right of the bar centred under it — and "1" leads six of the fifteen seconds
 * of inspection.
 *
 * Written to the element's style rather than kept in state: the clock redraws
 * every frame, and this changes once a second.
 */
export function useInkCentring(
  ref: RefObject<HTMLElement | null>,
  text: string,
  isEnabled: boolean,
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = context();
    if (!isEnabled || measure === null) {
      element.style.translate = '';
      return;
    }

    const style = getComputedStyle(element);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let isCurrent = true;
    const place = () => {
      if (!isCurrent) return;
      measure.font = font;
      const metrics = measure.measureText(text);
      const inkCentre = (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2;
      element.style.translate = `${Math.round(metrics.width / 2 - inkCentre)}px 0`;
    };

    place();
    // Measured in the fallback face if the clock's own has not arrived yet.
    if (!document.fonts.check(font, text)) void document.fonts.load(font, text).then(place);
    return () => {
      isCurrent = false;
    };
  }, [ref, text, isEnabled]);
}
