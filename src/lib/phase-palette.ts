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
import { contrast, parseHex, shiftToContrast, softenToContrast, toHex, type Rgb } from './colour';
import { PHASE_SLOTS, SLOT_FACE } from './phase-colours';

/** Must match the light side of --surface in styles/tokens.css: the card a phase is read on. */
const PAPER: Rgb = { r: 0xfa, g: 0xfb, b: 0xfc };

/** Must match the dark side of --surface in styles/tokens.css. */
const NIGHT: Rgb = { r: 0x17, g: 0x1a, b: 0x21 };

/** Must match --ink-floor in styles/tokens.css. */
const INK_FLOOR: Rgb = { r: 0x0b, g: 0x0d, b: 0x12 };

/**
 * A phase as text on paper. Short of the 4.5 the prose holds, on purpose:
 * yellow is only yellow while it is light, and these are figures beside a
 * name that is also written in plain text on the same screen. It is where the
 * hand-picked palette this replaced had landed too.
 */
const INK_CONTRAST = 4;

/**
 * A phase as an area — a chart band, a block of a bar — on paper only has to
 * be told apart from the card. Every coloured face manages that as it is; the
 * white one is the card, so it is shaded as far as a band needs and no
 * further. The blocks wore the ink once, darkened for text, and a yellow face
 * darkened that far is mustard, not the cube's.
 */
const FILL_CONTRAST = 1.7;

/**
 * On a dark ground the white face is the opposite trouble: three times as far
 * out as the coloured bands beside it, so the cross — the smallest phase —
 * was the loudest thing on the screen, as a chart band and as a strip in every
 * row of the list alike. It is dimmed to about where a green face stands, and
 * the coloured faces are left as they are painted. Text keeps the face.
 */
const NIGHT_FILL_CONTRAST = 6;

/**
 * What a share written across a block is set in: white wherever the block can
 * carry it, and the far end of the dark ground only where it cannot — the
 * yellow, the green, the orange, the shaded white. One colour for every block
 * put dark figures on the red.
 *
 * Not simply whichever measures higher. On a saturated mid-tone the formula
 * scores dark lettering a shade above white while the eye reads it the other
 * way round, and taken literally it would have put dark figures on the red.
 */
const LETTERING_PALE: Rgb = { r: 0xff, g: 0xff, b: 0xff };
const LETTERING_DARK: Rgb = { r: 0x0f, g: 0x11, b: 0x15 };
const LETTERING_PALE_CONTRAST = 3.5;

/** What a face that does not parse falls back to, rather than a hole in the bar. */
const NEUTRAL: Rgb = { r: 0x86, g: 0x8e, b: 0xa3 };

export type PhasePalette = Record<string, string>;

export function phasePalette(faces: Readonly<Record<Face, string>>): PhasePalette {
  const palette: PhasePalette = {};

  for (const slot of PHASE_SLOTS) {
    const face = parseHex(faces[SLOT_FACE[slot]]) ?? NEUTRAL;
    const onDark = toHex(face);

    const onPaper = shiftToContrast(face, PAPER, INK_FLOOR, INK_CONTRAST);
    const ink = toHex(onPaper);
    const day = slot === 'first' ? shiftToContrast(face, PAPER, INK_FLOOR, FILL_CONTRAST) : face;
    const night = slot === 'first' ? softenToContrast(face, NIGHT, NIGHT_FILL_CONTRAST) : face;

    const lettering = (block: Rgb) =>
      toHex(contrast(block, LETTERING_PALE) >= LETTERING_PALE_CONTRAST ? LETTERING_PALE : LETTERING_DARK);

    palette[`--phase-${slot}`] = `light-dark(${ink}, ${onDark})`;
    palette[`--phase-ink-${slot}`] = `light-dark(${lettering(day)}, ${lettering(night)})`;
    palette[`--phase-fill-${slot}`] = `light-dark(${toHex(day)}, ${toHex(night)})`;
  }

  return palette;
}
