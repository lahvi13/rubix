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
import type { ResolvedTheme } from './appearance';

/**
 * How an arrow over a permutation case is painted: the skin's pale neutral,
 * with the dark one laid round it as a band. Never dark itself, in either
 * theme — the cube is drawn on dark plastic, and a dark arrow crossing the
 * gaps between stickers loses its outline and, at the head, its direction.
 */
export interface ArrowStyle {
  fill: string;
  band: string;
}

export interface CubeSkin {
  id: string;
  name: string;
  faces: Record<Face, string>;
  muted: string;
  outline: string;
  arrow: ArrowStyle;
}

/**
 * How much darker the two sides of a cube are drawn than its top, so the three
 * faces stay apart. The 3D player is lit to match (`lib/twisty-skin.ts`): the
 * still picture and the cube that replaces it are the same cube.
 */
export const SIDE_SHADE = { front: 0.88, right: 0.74 } as const;

/**
 * A skin as it is written down. The muted sticker is still a choice at this
 * point — the theme makes it, not the skin.
 */
interface CubeSkinDefinition extends Omit<CubeSkin, 'muted' | 'arrow'> {
  muted: Record<ResolvedTheme, string>;
  /** The pale neutral of the pair; `outline` is the dark one. */
  pale: string;
}

/*
 * Every skin is one real cube, written down as it is held here: yellow up,
 * green in front. That is a standard cube turned over — which also swaps its
 * poles' neighbours, so red ends up on the left and orange on the right. Only
 * a mirror image has it the other way round, and a cuber checking a case
 * against the cube in their hands would find one.
 */
export const CUBE_SKINS: readonly CubeSkinDefinition[] = [
  {
    id: 'classic',
    name: 'Classic',
    faces: {
      U: '#f2d024',
      D: '#f4f4f4',
      F: '#25b05a',
      B: '#2f6fd0',
      L: '#d63a3a',
      R: '#e8811c',
    },
    muted: { dark: '#525b70', light: '#c7cddb' },
    outline: '#0f1115',
    pale: '#f4f6fb',
  },
  {
    id: 'contrast',
    name: 'High contrast',
    faces: {
      U: '#ffe600',
      D: '#ffffff',
      F: '#00d26a',
      B: '#0084ff',
      L: '#ff2d2d',
      R: '#ff8a00',
    },
    muted: { dark: '#4b5468', light: '#bcc4d3' },
    outline: '#000000',
    pale: '#ffffff',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    faces: {
      U: '#f2e08a',
      D: '#eef0f4',
      F: '#8fd3a6',
      B: '#93b6e8',
      L: '#e79a9a',
      R: '#f0b681',
    },
    muted: { dark: '#5a6379', light: '#d2d8e3' },
    outline: '#1b1f28',
    pale: '#f2f4f8',
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
      L: '#d55e00',
      R: '#e69f00',
    },
    muted: { dark: '#4f586d', light: '#c4cbd9' },
    outline: '#0f1115',
    pale: '#f8fafc',
  },
];

const FALLBACK: CubeSkinDefinition = {
  id: 'classic',
  name: 'Classic',
  faces: { U: '#f2d024', D: '#f4f4f4', F: '#25b05a', B: '#2f6fd0', L: '#d63a3a', R: '#e8811c' },
  muted: { dark: '#525b70', light: '#c7cddb' },
  outline: '#0f1115',
  pale: '#f4f6fb',
};

function definitionById(id: string): CubeSkinDefinition {
  return CUBE_SKINS.find((skin) => skin.id === id) ?? CUBE_SKINS[0] ?? FALLBACK;
}

/** The six stickers alone, which is all the phase colours are taken from. */
export function facesOf(id: string): Readonly<Record<Face, string>> {
  return definitionById(id).faces;
}

export function skinById(id: string, theme: ResolvedTheme): CubeSkin {
  const definition = definitionById(id);
  return {
    id: definition.id,
    name: definition.name,
    faces: definition.faces,
    outline: definition.outline,
    muted: definition.muted[theme],
    arrow: { fill: definition.pale, band: definition.outline },
  };
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
    // Turned over, not painted over: swapping only the poles would leave a
    // cube that cannot be bought — the left and right of a cube change places
    // with its top and bottom.
    faces: {
      ...skin.faces,
      U: skin.faces.D,
      D: skin.faces.U,
      L: skin.faces.R,
      R: skin.faces.L,
    },
  };
}
