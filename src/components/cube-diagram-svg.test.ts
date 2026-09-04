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

    expect(withArrows).toContain('<line');
    expect(solved).not.toContain('<line');
  });

  it('gives back the same picture for the same case, and a new one per skin', () => {
    const first = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const again = diagramUrl(tPerm, 'lastLayer', 'full', defaultSkin('dark'));
    const other = CUBE_SKINS.find((skin) => skin.id !== defaultSkin('dark').id);

    expect(again).toBe(first);
    expect(diagramUrl(tPerm, 'lastLayer', 'full', skinById(other?.id ?? '', 'dark'))).not.toBe(first);
  });

  it('is a url an <img> can load', () => {
    const url = diagramUrl(tPerm, 'isometric', 'pair', defaultSkin('dark'));

    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(url.slice('data:image/svg+xml,'.length))).toContain('<polygon');
  });
});
