/**
 * A colour per solve phase, assigned by POSITION: phases come from
 * Method.phases and a method the app has never heard of must still get a
 * readable bar. The few phases whose name says what colour is being built
 * are the exception, listed below.
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

/** A method's phases in order, or only their keys. */
export type PhaseList = readonly (string | { readonly key: string })[];

/**
 * The phases coloured by what they are rather than by where they stand.
 *
 * Roux's first block is the blue one in every guide to it — as the second is
 * the green one, which its position gives it already — and grey said nothing
 * about it. ZZ's EOCross is a cross and more: every edge turned good first.
 * Under the cross's white it read as CFOP's cross run slow, and orange is the
 * one face neither other method opens on, so the three are told apart by
 * their first block of colour. Its pairs and last layer are CFOP's, and keep
 * CFOP's colours by position.
 *
 * A map and not a record: a phase key is whatever a method says it is.
 */
const NAMED_SLOT: ReadonlyMap<string, PhaseSlot> = new Map([
  ['fb', 'mid-4'],
  ['eocross', 'mid-3'],
]);

function slot(phases: PhaseList, index: number): PhaseSlot {
  const phase = phases[index];
  const named = NAMED_SLOT.get(typeof phase === 'string' ? phase : (phase?.key ?? ''));
  if (named !== undefined) return named;

  if (index <= 0) return 'first';
  if (index >= phases.length - 1) return 'last';
  return MIDDLE_SLOTS[(index - 1) % MIDDLE_SLOTS.length] ?? 'last';
}

/** The face of the cube a phase is coloured after. */
export function phaseFace(phases: PhaseList, index: number): Face {
  return SLOT_FACE[slot(phases, index)];
}

/** The phase as ink: text, a line, a block small enough to read as a mark. */
export function phaseColour(phases: PhaseList, index: number): string {
  return `var(--phase-${slot(phases, index)})`;
}

/**
 * What text written on the phase's own block — its fill — is set in: pale on
 * some faces, dark on others, whichever of the two the face carries better.
 */
export function phaseInkColour(phases: PhaseList, index: number): string {
  return `var(--phase-ink-${slot(phases, index)})`;
}

/**
 * The phase as a filled area: a chart band, a block of a bar, the swatch that
 * keys a bar. A separate slot rather than the ink: the ink is dark so that it
 * can carry text on a white page, and a band painted in it reads as mud
 * rather than as the face of a cube.
 */
export function phaseFillColour(phases: PhaseList, index: number): string {
  return `var(--phase-fill-${slot(phases, index)})`;
}
