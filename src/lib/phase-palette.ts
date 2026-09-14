/**
 * The phase colours, taken from the cube skin the reader picked. Written onto
 * the document as custom properties, each already a `light-dark()` pair, so a
 * theme flip needs nothing recomputed.
 *
 * On a dark ground every face is used as it is: the skins are painted to glow
 * there. Paper is where they need help, and each one gets a different amount
 * of it — see lib/colour.ts for why one percentage cannot serve them all.
 */

import type { Face } from '../domain/cube/notation';
import { parseHex, shiftToContrast, toHex, type Rgb } from './colour';
import { PHASE_SLOTS, SLOT_FACE } from './phase-colours';

/** Must match the light side of --surface in index.css: the card a phase is read on. */
const PAPER: Rgb = { r: 0xfa, g: 0xfb, b: 0xfc };

/** Must match --ink-floor in index.css. */
const INK_FLOOR: Rgb = { r: 0x0b, g: 0x0d, b: 0x12 };

/**
 * A phase as text on paper. Short of the 4.5 the prose holds, on purpose:
 * yellow is only yellow while it is light, and these are figures beside a
 * name that is also written in plain text on the same screen. It is where the
 * hand-picked palette this replaced had landed too.
 */
const INK_CONTRAST = 4;

/**
 * A phase as an area on paper only has to be told apart from the card. Every
 * coloured face manages that as it is; the white one is the card, so it is
 * shaded as far as a band needs and no further.
 */
const FILL_CONTRAST = 1.7;

/** What a face that does not parse falls back to, rather than a hole in the bar. */
const NEUTRAL: Rgb = { r: 0x86, g: 0x8e, b: 0xa3 };

export type PhasePalette = Record<string, string>;

export function phasePalette(faces: Readonly<Record<Face, string>>): PhasePalette {
  const palette: PhasePalette = {};

  for (const slot of PHASE_SLOTS) {
    const face = parseHex(faces[SLOT_FACE[slot]]) ?? NEUTRAL;
    const onDark = toHex(face);

    const ink = toHex(shiftToContrast(face, PAPER, INK_FLOOR, INK_CONTRAST));
    const fill =
      slot === 'first' ? toHex(shiftToContrast(face, PAPER, INK_FLOOR, FILL_CONTRAST)) : onDark;

    palette[`--phase-${slot}`] = `light-dark(${ink}, ${onDark})`;
    palette[`--phase-fill-${slot}`] = `light-dark(${fill}, ${onDark})`;
  }

  return palette;
}
