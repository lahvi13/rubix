/**
 * sRGB colour maths, enough of it to keep a palette readable.
 *
 * The cube skins are painted for plastic, not for text: a yellow face and a
 * blue one are nowhere near the same brightness, so darkening them all by one
 * percentage — the trick that works for a trigger's colour — leaves the yellow
 * illegible and the blue muddy. What follows measures instead, to WCAG 2.1,
 * and shifts each colour only as far as it has to go.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` and `#rrggbb`; anything else is not a colour we wrote down. */
export function parseHex(hex: string): Rgb | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  const digits = match[1] ?? '';
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** `amount` is how much of `from` survives: 1 is `from`, 0 is `to`. */
export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  const at = Math.min(1, Math.max(0, amount));
  return {
    r: from.r * at + to.r * (1 - at),
    g: from.g * at + to.g * (1 - at),
    b: from.b * at + to.b * (1 - at),
  };
}

/** WCAG 2.1 relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const unit = value / 255;
    return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/**
 * How many halvings the search below does. Ten brings the interval under a
 * thousandth, which is finer than the byte the answer is rounded to.
 */
const STEPS = 10;

/**
 * `colour` shifted towards `towards` until it stands at `target` against
 * `ground` — and left alone when it already does.
 *
 * The search only holds because the shift is monotonic: `towards` is the far
 * side of `ground`, so every step away from the colour is a step of contrast
 * gained. Handing it a `towards` on the same side as `ground` would ask for
 * the one thing mixing cannot do, and the guard below is what says so.
 */
export function shiftToContrast(
  colour: Rgb,
  ground: Rgb,
  towards: Rgb,
  target: number,
): Rgb {
  if (contrast(colour, ground) >= target) return colour;
  if (contrast(towards, ground) < target) return towards;

  // Everything in [0, low] reaches the target; everything in (high, 1] does
  // not. Keeping as much of the face as possible means converging on `high`.
  // Measured on whole bytes, because that is what gets written down: a mix
  // that lands on the target exactly can round to just short of it.
  let low = 0;
  let high = 1;
  for (let step = 0; step < STEPS; step++) {
    const middle = (low + high) / 2;
    if (contrast(rounded(mix(colour, towards, middle)), ground) >= target) low = middle;
    else high = middle;
  }
  return rounded(mix(colour, towards, low));
}

function rounded({ r, g, b }: Rgb): Rgb {
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
