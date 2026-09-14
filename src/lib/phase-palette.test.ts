import { describe, expect, it } from 'vitest';
import { contrast, parseHex, type Rgb } from './colour';
import { CUBE_SKINS } from './cube-skins';
import { PHASE_SLOTS, SLOT_FACE } from './phase-colours';
import { phasePalette } from './phase-palette';

const PAPER: Rgb = { r: 0xfa, g: 0xfb, b: 0xfc };

/** The two sides of a `light-dark(a, b)` value. */
function sides(value: string | undefined): { light: Rgb; dark: Rgb } {
  const match = /^light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/.exec(value ?? '');
  const light = parseHex(match?.[1] ?? '');
  const dark = parseHex(match?.[2] ?? '');
  if (!light || !dark) throw new Error(`not a light-dark pair: ${value}`);
  return { light, dark };
}

describe.each(CUBE_SKINS.map((skin) => [skin.name, skin] as const))('%s', (_, skin) => {
  const palette = phasePalette(skin.faces);

  it.each(PHASE_SLOTS)('%s is its face as it is on a dark ground', (slot) => {
    const face = parseHex(skin.faces[SLOT_FACE[slot]]);
    expect(sides(palette[`--phase-${slot}`]).dark).toEqual(face);
    expect(sides(palette[`--phase-fill-${slot}`]).dark).toEqual(face);
  });

  it.each(PHASE_SLOTS)('%s can be read as text on paper', (slot) => {
    expect(contrast(sides(palette[`--phase-${slot}`]).light, PAPER)).toBeGreaterThanOrEqual(4);
  });

  it('shades the white face just enough to be a band on paper', () => {
    const fill = sides(palette['--phase-fill-first']).light;
    expect(contrast(fill, PAPER)).toBeGreaterThanOrEqual(1.7);
    expect(contrast(fill, PAPER)).toBeLessThan(2);
  });

  it('leaves every coloured face its own colour as an area', () => {
    for (const slot of PHASE_SLOTS.filter((each) => each !== 'first')) {
      const { light, dark } = sides(palette[`--phase-fill-${slot}`]);
      expect(light).toEqual(dark);
    }
  });
});

it('draws a face it cannot read in a neutral, not as a hole', () => {
  const faces = { U: 'yellow', D: '#fff', F: '#0f0', B: '#00f', L: '#f00', R: '#f80' };
  expect(sides(phasePalette(faces)['--phase-last']).dark).toEqual({ r: 0x86, g: 0x8e, b: 0xa3 });
});
