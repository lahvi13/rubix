import { describe, expect, it } from 'vitest';
import { parseAlg } from '../domain/cube/notation';
import { applyAlg, solvedState } from '../domain/cube/state';
import { CUBE_SKINS, defaultSkin, skinById } from '../lib/cube-skins';
import { diagramImageUrl, diagramSvg, diagramUrl } from './cube-diagram-svg';

const moves = (text: string) => {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text}`);
  return parsed.moves;
};

const tPerm = applyAlg(solvedState(), moves("R U R' U' R' F R2 U' R' U' R U R' F'"));

describe('cube diagrams as text', () => {
  it.each(['lastLayer', 'isometric', 'net'] as const)('draws a %s picture', (view) => {
    const svg = diagramSvg(tPerm, view, 'full', defaultSkin('dark'));

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    // Every sticker of the cube is in there, whatever shape it is drawn as.
    expect((svg.match(/<rect|<polygon/g) ?? []).length).toBeGreaterThanOrEqual(21);
  });

  it('shows where the pieces go, which is the point of a permutation case', () => {
    const withArrows = diagramSvg(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const solved = diagramSvg(solvedState(), 'lastLayer', 'full', defaultSkin('dark'));

    // A last-layer picture is stickers, which are rects; the arrows are the
    // only polygons in it.
    expect(withArrows).toContain('<polygon');
    expect(solved).not.toContain('<polygon');
  });

  it.each(['dark', 'light'] as const)('paints the arrow pale on the %s theme', (theme) => {
    const skin = defaultSkin(theme);
    const svg = diagramSvg(tPerm, 'lastLayer', 'full', skin);

    // The cube stands on dark plastic whatever the page is, so the arrow is
    // the pale neutral in a band of the dark one. In the outline colour alone
    // it would read as a gap in the grid.
    expect(svg).toContain(`fill="${skin.arrow.fill}"`);
    expect(skin.arrow.fill).not.toBe(skin.outline);
    expect(skin.arrow.band).toBe(skin.outline);
  });

  it('stands the cube on slate plastic on a light page, and black on a dark one', () => {
    const light = skinById('classic', 'light');
    const dark = skinById('classic', 'dark');

    expect(diagramSvg(tPerm, 'lastLayer', 'full', light)).toContain(`fill="${light.outline}"`);
    expect(light.outline).not.toBe(dark.outline);
    // Except on the skin whose whole point is to be stark.
    expect(skinById('contrast', 'light').outline).toBe(skinById('contrast', 'dark').outline);
  });

  it('keeps the two themes apart in the cache', () => {
    // Greyed stickers are the part of a picture the theme changes.
    const dark = diagramUrl(tPerm, 'lastLayer', 'corners', defaultSkin('dark'));
    const light = diagramUrl(tPerm, 'lastLayer', 'corners', defaultSkin('light'));

    expect(dark).not.toBe(light);
  });

  it('gives back the same picture for the same case, and a new one per skin', () => {
    const first = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const again = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const other = CUBE_SKINS.find((skin) => skin.id !== defaultSkin('dark').id);

    expect(again).toBe(first);
    expect(diagramUrl(tPerm, 'lastLayer', 'full', skinById(other?.id ?? '', 'dark'))).not.toBe(first);
  });

  it('frames a marked corner, and only in the last-layer picture', () => {
    const skin = defaultSkin('dark');
    const frame = `fill="none" stroke="${skin.arrow.fill}"`;

    expect(diagramSvg(tPerm, 'lastLayer', 'orientation', skin, 'frontLeft')).toContain(frame);
    expect(diagramSvg(tPerm, 'lastLayer', 'orientation', skin)).not.toContain(frame);
    expect(diagramSvg(tPerm, 'isometric', 'full', skin, 'frontLeft')).toBe(
      diagramSvg(tPerm, 'isometric', 'full', skin),
    );
  });

  it.each(['backLeft', 'backRight', 'frontLeft', 'frontRight'] as const)(
    'keeps the frame round the %s corner whole inside the picture',
    (mark) => {
      const svg = diagramSvg(solvedState(), 'lastLayer', 'orientation', defaultSkin('dark'), mark);
      const size = Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1]);
      // The wider of the two strokes: the dark band the pale line sits on.
      const box = new RegExp(
        '<rect x="([\\d.]+)" y="([\\d.]+)" width="([\\d.]+)" height="[\\d.]+" rx="3"' +
          ' fill="none" stroke="[^"]+" stroke-width="([\\d.]+)"',
      ).exec(svg);
      const [x, y, side, width] = (box?.slice(1) ?? []).map(Number) as number[];

      expect(box).not.toBeNull();
      for (const start of [x ?? 0, y ?? 0]) {
        expect(start - (width ?? 0) / 2).toBeGreaterThanOrEqual(0);
        expect(start + (side ?? 0) + (width ?? 0) / 2).toBeLessThanOrEqual(size);
      }
    },
  );

  it('keeps a marked picture apart from the plain one in the cache', () => {
    const skin = defaultSkin('dark');

    expect(diagramUrl(tPerm, 'lastLayer', 'orientation', skin, 'frontLeft')).not.toBe(
      diagramUrl(tPerm, 'lastLayer', 'orientation', skin),
    );
  });

  it('is a url an <img> can load', () => {
    const url = diagramUrl(tPerm, 'isometric', 'firstTwoLayers', defaultSkin('dark'));

    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(url.slice('data:image/svg+xml,'.length))).toContain('<polygon');
  });

  it('gives a picture for a canvas a size of its own, in the shape of the cube', () => {
    const url = diagramImageUrl(tPerm, 'net', 'full', defaultSkin('dark'), 400);
    const drawn = decodeURIComponent(url.slice('data:image/svg+xml,'.length));
    const [, , boxWidth = 0, boxHeight = 0] =
      /viewBox="([^"]+)"/.exec(drawn)?.[1]?.split(' ').map(Number) ?? [];

    expect(drawn).toContain('width="400"');
    expect(drawn).toContain(`height="${Math.round((400 * boxHeight) / boxWidth)}"`);
  });
});
