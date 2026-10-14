import { describe, expect, it, vi } from 'vitest';
import { SIDE_SHADE, defaultSkin } from './cube-skins';
import { paintCube, sideLighting } from './twisty-skin';

describe('sideLighting', () => {
  const light = sideLighting(SIDE_SHADE);
  const shadeOf = (x: number, y: number) => light.base + light.x * x + light.y * y;

  // How each face the still picture shows faces the viewer (x right, y up).
  it.each([
    ['top', 0, Math.sqrt(2 / 3), 1],
    ['front', -Math.SQRT1_2, -Math.sqrt(1 / 6), SIDE_SHADE.front],
    ['right', Math.SQRT1_2, -Math.sqrt(1 / 6), SIDE_SHADE.right],
  ])('lights the %s face as the picture shades it', (_face, x, y, expected) => {
    expect(shadeOf(x, y)).toBeCloseTo(expected, 10);
  });
});

/** A material as much as the painter touches one. */
function material(visible = true) {
  const made = {
    visible,
    transparent: true,
    opacity: 0.5,
    color: { style: '', setStyle: (style: string) => (made.color.style = style) },
    onBeforeCompile: () => {},
    clone: () => material(visible),
  };
  return made;
}

/**
 * Enough of cubing.js's PG3D to paint: two corners of three stickers each, in
 * its own colours (white, red, green; yellow, orange, blue), and the material
 * lists it draws from.
 */
function fakePG3D() {
  const colours = [
    [0xffffff, 0xff0000, 0x44ee00],
    [0xf4f400, 0xff8000, 0x2266ff],
  ];
  // By facelet, then by piece, as PG3D keeps them.
  const stickers = {
    CORNERS: [0, 1, 2].map((facelet) =>
      [0, 1].map((piece) => ({ origColor: colours[piece]?.[facelet] ?? 0 })),
    ),
  };
  const sticker = material();
  const foundation = material();
  const pg = {
    stickers,
    materialArray1: [sticker, material(false), material(false), material(false), material(false), material(false), foundation, material(false)],
    materialArray2: [material(false), sticker, material(false), material(false), material(false), material(false), material(false), foundation],
    params: {} as { stickeringMask?: unknown },
    masks: [] as unknown[],
    setStickeringMask(mask: unknown) {
      pg.masks.push(mask);
      pg.params.stickeringMask = mask;
    },
    updateMaterialArrays() {
      pg.materialArray1[0] = sticker;
      pg.materialArray2[1] = sticker;
      pg.materialArray1[6] = foundation;
      pg.materialArray2[7] = foundation;
    },
    scheduleRenderCallback: vi.fn(),
  };
  return { pg, sticker, foundation };
}

const hex = (colour: string) => Number.parseInt(colour.slice(1, 7), 16);

describe('painting the 2×2', () => {
  const skin = defaultSkin('dark');

  it("gives every sticker the skin's colour for the face cubing.js coloured it as", () => {
    const { pg } = fakePG3D();
    paintCube(pg, skin);

    const [white, red, green] = [0, 1, 2].map((facelet) => pg.stickers.CORNERS[facelet]?.[0]?.origColor);
    expect([white, red, green]).toEqual([hex(skin.faces.D), hex(skin.faces.L), hex(skin.faces.F)]);
    const [yellow, orange, blue] = [0, 1, 2].map((facelet) => pg.stickers.CORNERS[facelet]?.[1]?.origColor);
    expect([yellow, orange, blue]).toEqual([hex(skin.faces.U), hex(skin.faces.R), hex(skin.faces.B)]);
    expect(pg.scheduleRenderCallback).toHaveBeenCalled();
  });

  it("paints a greyed sticker in the skin's muted colour and hands it over as an ordinary one", () => {
    const { pg } = fakePG3D();
    paintCube(pg, skin);

    pg.setStickeringMask({
      orbits: { CORNERS: { pieces: [{ facelets: ['regular', 'ignored', { mask: 'ignored' }] }, null] } },
    });

    expect(pg.stickers.CORNERS[0]?.[0]?.origColor).toBe(hex(skin.faces.D));
    expect(pg.stickers.CORNERS[1]?.[0]?.origColor).toBe(hex(skin.muted));
    expect(pg.stickers.CORNERS[2]?.[0]?.origColor).toBe(hex(skin.muted));
    // PG3D's own grey is never asked for, and every orbit is in what it gets.
    expect(JSON.stringify(pg.masks.at(-1))).not.toContain('ignored');
    expect(pg.masks.at(-1)).toEqual({
      orbits: {
        CORNERS: {
          pieces: [{ facelets: ['regular', 'regular', 'regular'] }, { facelets: ['regular', 'regular', 'regular'] }],
        },
      },
    });
  });

  it('repaints in another skin, greyed stickers staying grey', () => {
    const { pg } = fakePG3D();
    paintCube(pg, skin);
    pg.setStickeringMask({ orbits: { CORNERS: { pieces: [{ facelets: ['ignored', 'regular', 'regular'] }, null] } } });

    const light = defaultSkin('light');
    paintCube(pg, light);

    expect(pg.stickers.CORNERS[0]?.[0]?.origColor).toBe(hex(light.muted));
    expect(pg.stickers.CORNERS[1]?.[0]?.origColor).toBe(hex(light.faces.L));
  });

  it('keeps its own materials in place, the plastic solid in the outline colour', () => {
    const { pg, sticker, foundation } = fakePG3D();
    paintCube(pg, skin);

    expect(pg.materialArray1[0]).not.toBe(sticker);
    expect(pg.materialArray2[1]).toBe(pg.materialArray1[0]);
    expect(pg.materialArray1[6]).not.toBe(foundation);
    expect(pg.materialArray1[6]?.transparent).toBe(false);
    expect(pg.materialArray1[6]?.color.style).toBe(skin.outline);

    // cubing.js puts its own back whenever its options change.
    pg.updateMaterialArrays();
    expect(pg.materialArray1[0]).not.toBe(sticker);
    expect(pg.materialArray1[6]).not.toBe(foundation);
  });

  it('leaves alone a cube whose colours it does not know', () => {
    const { pg } = fakePG3D();
    const first = pg.stickers.CORNERS[0]?.[0];
    if (first) first.origColor = 0x123456;
    paintCube(pg, skin);

    expect(pg.stickers.CORNERS[1]?.[0]?.origColor).toBe(0xff0000);
    expect(pg.masks).toHaveLength(0);
  });
});
