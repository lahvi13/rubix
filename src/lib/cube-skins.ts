/**
 * Sticker palettes for the case diagrams.
 *
 * The last layer is drawn yellow-on-top, the way every CFOP diagram is drawn:
 * the cross is white and lives on the bottom, so U is the yellow face here.
 * `muted` is for stickers a case does not depend on — they are still drawn,
 * because an empty square reads as a hole in the cube.
 */

import type { Face } from '../domain/cube/notation';

export interface CubeSkin {
  id: string;
  name: string;
  faces: Record<Face, string>;
  muted: string;
  outline: string;
  /** Arrows drawn over the stickers of a permutation case. */
  arrow: string;
}

export const CUBE_SKINS: readonly CubeSkin[] = [
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
    muted: '#525b70',
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
    muted: '#4b5468',
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
    muted: '#5a6379',
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
    muted: '#4f586d',
    outline: '#0f1115',
    arrow: '#f8fafc',
  },
];

export const DEFAULT_CUBE_SKIN = CUBE_SKINS[0] ?? {
  id: 'classic',
  name: 'Classic',
  faces: { U: '#f2d024', D: '#f4f4f4', F: '#25b05a', B: '#2f6fd0', L: '#e8811c', R: '#d63a3a' },
  muted: '#525b70',
  outline: '#0f1115',
  arrow: '#f4f6fb',
};

export function skinById(id: string): CubeSkin {
  return CUBE_SKINS.find((skin) => skin.id === id) ?? DEFAULT_CUBE_SKIN;
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
