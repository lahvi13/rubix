/**
 * A colour per solve phase, assigned by POSITION, not by name: phases come
 * from Method.phases and a method the app has never heard of must still get a
 * readable bar.
 *
 * The colours themselves live in the stylesheet, one variable per slot, so
 * that both themes can pick their own version of "the white cross" — see the
 * --phase-* tokens in index.css.
 */

const FIRST_SLOT = 'first';
const LAST_SLOT = 'last';
const MIDDLE_SLOTS = ['mid-1', 'mid-2', 'mid-3', 'mid-4'];

function slot(index: number, count: number): string {
  if (index <= 0) return FIRST_SLOT;
  if (index >= count - 1) return LAST_SLOT;
  return MIDDLE_SLOTS[(index - 1) % MIDDLE_SLOTS.length] ?? LAST_SLOT;
}

/** The phase as ink: text, a line, a block small enough to read as a mark. */
export function phaseColour(index: number, count: number): string {
  return `var(--phase-${slot(index, count)})`;
}

/**
 * The phase as a filled area. A separate slot rather than the same colour at
 * a lower opacity: the ink is dark so that it can carry text on a white page,
 * and a chart band the size of a thumb painted in it reads as mud rather than
 * as the face of a cube.
 */
export function phaseFillColour(index: number, count: number): string {
  return `var(--phase-fill-${slot(index, count)})`;
}
