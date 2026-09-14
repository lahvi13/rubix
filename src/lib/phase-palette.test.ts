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

describe('lettering across a block', () => {
  const WHITE = { r: 255, g: 255, b: 255 };
  const DARK = { r: 0x0f, g: 0x11, b: 0x15 };

  it.each(CUBE_SKINS.flatMap((skin) => PHASE_SLOTS.map((slot) => [skin.name, slot, skin] as const)))(
    '%s %s is readable on both themes',
    (_, slot, skin) => {
      const palette = phasePalette(skin.faces);
      const block = sides(palette[`--phase-${slot}`]);
      const lettering = sides(palette[`--phase-ink-${slot}`]);
      for (const theme of ['light', 'dark'] as const) {
        expect(contrast(block[theme], lettering[theme])).toBeGreaterThanOrEqual(3.5);
      }
    },
  );

  it.each(CUBE_SKINS.map((skin) => [skin.name, skin] as const))(
    '%s keeps white on every block on paper',
    (_, skin) => {
      const palette = phasePalette(skin.faces);
      for (const slot of PHASE_SLOTS) {
        expect(sides(palette[`--phase-ink-${slot}`]).light).toEqual(WHITE);
      }
    },
  );

  it.each([
    // The case that asked for it: the classic red carries white better.
    ['classic', 'mid-2', 'dark', WHITE],
    ['classic', 'last', 'dark', DARK],
    ['classic', 'mid-1', 'dark', DARK],
    ['classic', 'mid-3', 'dark', DARK],
    ['classic', 'mid-4', 'dark', WHITE],
    ['contrast', 'mid-2', 'dark', WHITE],
    ['accessible', 'mid-2', 'dark', WHITE],
    ['pastel', 'mid-2', 'dark', DARK],
  ] as const)('%s %s on %s', (id, slot, theme, expected) => {
    const skin = CUBE_SKINS.find((each) => each.id === id);
    if (!skin) throw new Error(id);
    expect(sides(phasePalette(skin.faces)[`--phase-ink-${slot}`])[theme]).toEqual(expected);
  });
});

it('gives OLL — the second phase of four — the red face', () => {
  expect(SLOT_FACE['mid-2']).toBe('L');
});
