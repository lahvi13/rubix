import { describe, expect, it } from 'vitest';
import { parseAlg } from '../domain/cube/notation';
import { applyAlg, solvedState } from '../domain/cube/state';
import { CUBE_SKINS, defaultSkin, skinById } from '../lib/cube-skins';
import { diagramSvg, diagramUrl } from './cube-diagram-svg';

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

  it('paints the arrows the way round the theme needs', () => {
    const skins = { dark: defaultSkin('dark'), light: defaultSkin('light') };
    const svgs = {
      dark: diagramSvg(tPerm, 'lastLayer', 'full', skins.dark),
      light: diagramSvg(tPerm, 'lastLayer', 'full', skins.light),
    };

    // A dark card takes the pale arrow and a light one the dark arrow. Neither
    // may be the bare outline colour: the stickers wear that as their own
    // outline, and an arrow in it would read as a gap in the grid.
    expect(svgs.dark).toContain(`fill="${skins.dark.arrow.fill}"`);
    expect(skins.dark.arrow.fill).not.toBe(skins.dark.outline);
    expect(svgs.light).toContain(`fill="${skins.light.arrow.fill}"`);
    expect(skins.light.arrow.fill).toBe(skins.light.outline);
    expect(skins.light.arrow.band).not.toBe(skins.light.outline);
    expect(svgs.dark).not.toBe(svgs.light);
  });

  it('keeps the two themes apart in the cache', () => {
    const dark = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const light = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('light'));

    expect(dark).not.toBe(light);
  });

  it('gives back the same picture for the same case, and a new one per skin', () => {
    const first = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const again = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const other = CUBE_SKINS.find((skin) => skin.id !== defaultSkin('dark').id);

    expect(again).toBe(first);
    expect(diagramUrl(tPerm, 'lastLayer', 'full', skinById(other?.id ?? '', 'dark'))).not.toBe(first);
  });

  it('is a url an <img> can load', () => {
    const url = diagramUrl(tPerm, 'isometric', 'firstTwoLayers', defaultSkin('dark'));

    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(url.slice('data:image/svg+xml,'.length))).toContain('<polygon');
  });
});
