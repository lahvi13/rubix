/**
 * A colour per solve phase, assigned by POSITION, not by name: phases come
 * from Method.phases and a method the app has never heard of must still get a
 * readable bar.
 *
 * Each slot is a face of the cube, and the colour is whatever that face wears
 * in the skin the reader picked — see lib/phase-palette.ts, which turns a skin
 * into the --phase-* variables these hand out.
 */

import type { Face } from '../domain/cube/notation';

export type PhaseSlot = 'first' | 'mid-1' | 'mid-2' | 'mid-3' | 'mid-4' | 'last';

const MIDDLE_SLOTS: readonly PhaseSlot[] = ['mid-1', 'mid-2', 'mid-3', 'mid-4'];

export const PHASE_SLOTS: readonly PhaseSlot[] = ['first', ...MIDDLE_SLOTS, 'last'];

/**
 * The cross is solved on the white face and the last layer is the yellow one,
 * so the ramp reads first-to-last the way the cube does. The faces are named
 * as the skins hold the cube — yellow up — which puts white at D.
 *
 * The two in between are the pair the trainer shows an F2L case from, green
 * and red. Orange was the second once, and it sat against the yellow of the
 * last layer in every bar: the two warmest faces, told apart worst of any
 * pair, and on paper a burnt orange beside a mustard.
 */
export const SLOT_FACE: Record<PhaseSlot, Face> = {
  first: 'D',
  'mid-1': 'F',
  'mid-2': 'L',
  'mid-3': 'R',
  'mid-4': 'B',
  last: 'U',
};

function slot(index: number, count: number): PhaseSlot {
  if (index <= 0) return 'first';
  if (index >= count - 1) return 'last';
  return MIDDLE_SLOTS[(index - 1) % MIDDLE_SLOTS.length] ?? 'last';
}

/** The phase as ink: text, a line, a block small enough to read as a mark. */
export function phaseColour(index: number, count: number): string {
  return `var(--phase-${slot(index, count)})`;
}

/**
 * What text written on the phase's own block — its fill — is set in: pale on
 * some faces, dark on others, whichever of the two the face carries better.
 */
export function phaseInkColour(index: number, count: number): string {
  return `var(--phase-ink-${slot(index, count)})`;
}

/**
 * The phase as a filled area: a chart band, a block of a bar, the swatch that
 * keys a bar. A separate slot rather than the ink: the ink is dark so that it
 * can carry text on a white page, and a band painted in it reads as mud
 * rather than as the face of a cube.
 */
export function phaseFillColour(index: number, count: number): string {
  return `var(--phase-fill-${slot(index, count)})`;
}
