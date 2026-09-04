/**
 * Sticker palettes for the case diagrams.
 *
 * The last layer is drawn yellow-on-top, the way every CFOP diagram is drawn:
 * the cross is white and lives on the bottom, so U is the yellow face here.
 * `muted` is for stickers a case does not depend on — they are still drawn,
 * because an empty square reads as a hole in the cube. Those are the one part
 * of a skin that has to know about the theme: a sticker that recedes into a
 * dark card is a slab of ink on a white one.
 */

import type { Face } from '../domain/cube/notation';
import type { ResolvedTheme } from './theme';

export interface CubeSkin {
  id: string;
  name: string;
  faces: Record<Face, string>;
  muted: string;
  outline: string;
  /** Arrows drawn over the stickers of a permutation case. */
  arrow: string;
}

/** A skin as it is written down: muted still has both themes to choose from. */
interface CubeSkinDefinition extends Omit<CubeSkin, 'muted'> {
  muted: Record<ResolvedTheme, string>;
}

export const CUBE_SKINS: readonly CubeSkinDefinition[] = [
  {
    id: 'classic',
    name: 'Classic',
    faces: {
      U: '#f2d024',
      D: '#f4f4f4',
      F: '#25b05a',
      B: '#2f6fd0',
      L: '#e8811c',
      R: '#d63a3a',
    },
    muted: { dark: '#525b70', light: '#c7cddb' },
    outline: '#0f1115',
    arrow: '#f4f6fb',
  },
  {
    id: 'contrast',
    name: 'High contrast',
    faces: {
      U: '#ffe600',
      D: '#ffffff',
      F: '#00d26a',
      B: '#0084ff',
      L: '#ff8a00',
      R: '#ff2d2d',
    },
    muted: { dark: '#4b5468', light: '#bcc4d3' },
    outline: '#000000',
    arrow: '#ffffff',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    faces: {
      U: '#f2e08a',
      D: '#eef0f4',
      F: '#8fd3a6',
      B: '#93b6e8',
      L: '#f0b681',
      R: '#e79a9a',
    },
    muted: { dark: '#5a6379', light: '#d2d8e3' },
    outline: '#1b1f28',
    arrow: '#f2f4f8',
  },
  {
    // Red and green are the pair most often confused; this swaps them for a
    // blue-and-vermillion pair that stays distinct without colour vision.
    id: 'accessible',
    name: 'Colour-blind friendly',
    faces: {
      U: '#f0e442',
      D: '#ffffff',
      F: '#009e73',
      B: '#0072b2',
      L: '#e69f00',
      R: '#d55e00',
    },
    muted: { dark: '#4f586d', light: '#c4cbd9' },
    outline: '#0f1115',
    arrow: '#f8fafc',
  },
];

const FALLBACK: CubeSkinDefinition = {
  id: 'classic',
  name: 'Classic',
  faces: { U: '#f2d024', D: '#f4f4f4', F: '#25b05a', B: '#2f6fd0', L: '#e8811c', R: '#d63a3a' },
  muted: { dark: '#525b70', light: '#c7cddb' },
  outline: '#0f1115',
  arrow: '#f4f6fb',
};

export function skinById(id: string, theme: ResolvedTheme): CubeSkin {
  const definition = CUBE_SKINS.find((skin) => skin.id === id) ?? CUBE_SKINS[0] ?? FALLBACK;
  return { ...definition, muted: definition.muted[theme] };
}

export function defaultSkin(theme: ResolvedTheme): CubeSkin {
  return skinById(FALLBACK.id, theme);
}

/**
 * The same skin held the other way up: white on top, green at the front. That
 * is the orientation a scramble is defined in, and a scramble preview showing
 * yellow on top would be a picture of a cube nobody is holding.
 */
export function withWhiteTop(skin: CubeSkin): CubeSkin {
  return {
    ...skin,
    faces: { ...skin.faces, U: skin.faces.D, D: skin.faces.U },
  };
}
