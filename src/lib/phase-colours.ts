/**
 * A colour per solve phase, assigned by POSITION, not by name: phases come
 * from Method.phases and a method the app has never heard of must still get a
 * readable bar.
 *
 * The colours themselves live in the stylesheet, one variable per slot, so
 * that both themes can pick their own version of "the white cross" — see the
 * --phase-* tokens in index.css.
 */

const FIRST_PHASE = 'var(--phase-first)';
const LAST_PHASE = 'var(--phase-last)';
const MIDDLE_PHASES = [
  'var(--phase-mid-1)',
  'var(--phase-mid-2)',
  'var(--phase-mid-3)',
  'var(--phase-mid-4)',
];

export function phaseColour(index: number, count: number): string {
  if (index <= 0) return FIRST_PHASE;
  if (index >= count - 1) return LAST_PHASE;
  return MIDDLE_PHASES[(index - 1) % MIDDLE_PHASES.length] ?? LAST_PHASE;
}
