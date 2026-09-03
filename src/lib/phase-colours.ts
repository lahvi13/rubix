/**
 * A colour per solve phase, assigned by POSITION, not by name: phases come
 * from Method.phases and a method the app has never heard of must still get a
 * readable bar.
 *
 * The two ends carry the meaning. The first phase is the cross, which is
 * white on a standard cube, and the last one finishes the yellow layer — so
 * the ramp reads first-to-last the way the cube does. Anything in between
 * takes the remaining sticker colours in order.
 */

const FIRST_PHASE = '#e6eaf2';
const LAST_PHASE = '#f2d024';
const MIDDLE_PHASES = ['#25b05a', '#e8811c', '#2f6fd0', '#d63a3a'];

export function phaseColour(index: number, count: number): string {
  if (index <= 0) return FIRST_PHASE;
  if (index >= count - 1) return LAST_PHASE;
  return MIDDLE_PHASES[(index - 1) % MIDDLE_PHASES.length] ?? LAST_PHASE;
}
