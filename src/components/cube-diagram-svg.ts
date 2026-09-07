/**
 * Cube pictures as SVG text, kept in a cache.
 *
 * A set screen shows up to fifty-seven cubes, and a cube drawn as elements is
 * fifty-four of them — three thousand nodes for one screen, which a phone
 * spends seconds laying out while nothing else, taps included, gets a turn.
 * As text it is one image element per cube, and a picture already drawn is
 * simply handed back: the same case in the same skin never gets built twice.
 */

import { stateKey, type CubeState } from '../domain/cube/state';
import {
  isometricView,
  lastLayerView,
  netView,
  permutationArrows,
  type Cell,
  type PieceArrow,
  type Stickering,
} from '../domain/cube/views';
import type { CubeSkin } from '../lib/cube-skins';

export type DiagramView = 'lastLayer' | 'isometric' | 'net';

/**
 * Big enough for every set drawn twice over, small enough to throw away
 * without a thought. Changing the skin makes every key miss, which is when the
 * whole thing is worth dropping.
 */
const CACHE_LIMIT = 400;
const cache = new Map<string, string>();

export function diagramUrl(
  state: CubeState,
  view: DiagramView,
  stickering: Stickering,
  skin: CubeSkin,
): string {
  // Everything the theme changes about a skin belongs in the key, or a picture
  // drawn before the theme flipped gets handed back after it.
  const key = `${skin.id}|${skin.muted}|${skin.arrow.build}|${view}|${stickering}|${stateKey(state)}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const url = `data:image/svg+xml,${encodeURIComponent(diagramSvg(state, view, stickering, skin))}`;
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, url);
  return url;
}

export function diagramSvg(
  state: CubeState,
  view: DiagramView,
  stickering: Stickering,
  skin: CubeSkin,
): string {
  if (view === 'lastLayer') return lastLayerSvg(state, stickering, skin);
  if (view === 'net') return netSvg(state, stickering, skin);
  return isometricSvg(state, stickering, skin);
}

const NS = 'http://www.w3.org/2000/svg';

function svg(viewBox: string, body: string): string {
  return `<svg xmlns="${NS}" viewBox="${viewBox}">${body}</svg>`;
}

/** Two decimals is under a tenth of a sticker; the rest is only string length. */
function n(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  fill: string,
  skin: CubeSkin,
  strokeWidth: number,
): string {
  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="${n(rx)}"` +
    ` fill="${fill}" stroke="${skin.outline}" stroke-width="${n(strokeWidth)}"/>`
  );
}

function polygon(points: string, fill: string, stroke: string, strokeWidth: number): string {
  return (
    `<polygon points="${points}" fill="${fill}" stroke="${stroke}"` +
    ` stroke-width="${n(strokeWidth)}" stroke-linejoin="round"/>`
  );
}

function colourOf(cell: Cell, skin: CubeSkin): string {
  return cell === null ? skin.muted : skin.faces[cell];
}

/** Sides of the cube are drawn darker, so the three faces stay apart. */
function shade(colour: string, factor: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(colour);
  if (!match?.[1]) return colour;

  const value = Number.parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const shaded = channels.map((channel) => Math.round(channel * factor));
  return `#${shaded.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/* Last layer: the top face with the four strips of side stickers around it. */

const CELL = 20;
const STRIP = 10;
const OFFSET = STRIP + 2;
const SIZE = OFFSET * 2 + CELL * 3;
const INSET = 1;

function lastLayerSvg(state: CubeState, stickering: Stickering, skin: CubeSkin): string {
  const view = lastLayerView(state, stickering);

  const top = view.top
    .map((cell, index) =>
      rect(
        OFFSET + (index % 3) * CELL + INSET,
        OFFSET + Math.floor(index / 3) * CELL + INSET,
        CELL - INSET * 2,
        CELL - INSET * 2,
        2,
        colourOf(cell, skin),
        skin,
        1,
      ),
    )
    .join('');

  const strip = (cell: Cell, index: number, at: number, horizontal: boolean): string => {
    const along = OFFSET + index * CELL + INSET;
    const length = CELL - INSET * 2;
    return rect(
      horizontal ? along : at,
      horizontal ? at : along,
      horizontal ? length : STRIP,
      horizontal ? STRIP : length,
      2,
      colourOf(cell, skin),
      skin,
      1,
    );
  };

  const sides = [
    view.back.map((cell, index) => strip(cell, index, 0, true)),
    view.front.map((cell, index) => strip(cell, index, SIZE - STRIP, true)),
    view.left.map((cell, index) => strip(cell, index, 0, false)),
    view.right.map((cell, index) => strip(cell, index, SIZE - STRIP, false)),
  ]
    .flat()
    .join('');

  const arrows = permutationArrows(state, stickering)
    .map((arrow) => arrowSvg(arrow, skin))
    .join('');

  return svg(`0 0 ${SIZE} ${SIZE}`, top + sides + arrows);
}

/** Centre of a cell of the top-face grid. */
function cellCentre(cell: number): readonly [number, number] {
  return [OFFSET + ((cell % 3) + 0.5) * CELL, OFFSET + (Math.floor(cell / 3) + 0.5) * CELL];
}

interface ArrowShape {
  /** Half the width of the body. */
  shaftHalf: number;
  headLength: number;
  headHalf: number;
  /** The band laid all round the arrow, outside it. */
  band: number;
}

/**
 * The two builds of the arrow, in the units of the picture — a sticker is 20.
 * The dark one is the slimmer: ink covers a sticker more heavily than paper
 * does at the same width, and it needs the wider band, because the stickers'
 * own outline is that very colour.
 */
const ARROW_SHAPES: Record<CubeSkin['arrow']['build'], ArrowShape> = {
  pale: { shaftHalf: 1.9, headLength: 8, headHalf: 4.6, band: 1.5 },
  dark: { shaftHalf: 1.4, headLength: 8.5, headHalf: 3.9, band: 1.2 },
};

/**
 * Where a piece has to go. Drawn short of both cells so the arrow sits between
 * the stickers rather than on top of them, and pointed at both ends for a swap.
 *
 * Body and head are one closed outline rather than a line with a triangle laid
 * on its end: a triangle wide enough to read has to be stroked to be seen over
 * a yellow sticker, and a stroke round a short triangle is a blob, not a point.
 */
function arrowSvg(arrow: PieceArrow, skin: CubeSkin): string {
  const { shaftHalf, headLength, headHalf, band } = ARROW_SHAPES[skin.arrow.build];
  const [fromX, fromY] = cellCentre(arrow.from);
  const [toX, toY] = cellCentre(arrow.to);
  const length = Math.hypot(toX - fromX, toY - fromY);
  const unitX = (toX - fromX) / length;
  const unitY = (toY - fromY) / length;

  const inset = CELL * 0.12;
  const startX = fromX + unitX * inset;
  const startY = fromY + unitY * inset;
  const span = length - inset * 2;

  /** A corner of the outline: how far along the arrow, and how far across it. */
  const at = (along: number, across: number): string =>
    `${n(startX + unitX * along - unitY * across)},${n(startY + unitY * along + unitX * across)}`;

  const shoulder = span - headLength;
  const points = (
    arrow.isSwap
      ? [
          at(0, 0),
          at(headLength, headHalf),
          at(headLength, shaftHalf),
          at(shoulder, shaftHalf),
          at(shoulder, headHalf),
          at(span, 0),
          at(shoulder, -headHalf),
          at(shoulder, -shaftHalf),
          at(headLength, -shaftHalf),
          at(headLength, -headHalf),
        ]
      : [
          at(0, shaftHalf),
          at(shoulder, shaftHalf),
          at(shoulder, headHalf),
          at(span, 0),
          at(shoulder, -headHalf),
          at(shoulder, -shaftHalf),
          at(0, -shaftHalf),
        ]
  ).join(' ');

  // The band is a stroke on a copy underneath, so it grows outwards only and
  // the arrow keeps the width it was drawn at. Mitred, or the point is rounded
  // off into the blob this build exists to avoid; the limit is what stops the
  // shoulders, where the head meets the body, spiking off on their own.
  return (
    `<polygon points="${points}" fill="${skin.arrow.band}" stroke="${skin.arrow.band}"` +
    ` stroke-width="${n(band * 2)}" stroke-linejoin="miter" stroke-miterlimit="4"/>` +
    `<polygon points="${points}" fill="${skin.arrow.fill}"/>`
  );
}

/* Net: the cube unfolded, for looking a scramble over. */

const NET_CELL = 12;
const NET_FACE = NET_CELL * 3;
const NET_GAP = 2;

function netSvg(state: CubeState, stickering: Stickering, skin: CubeSkin): string {
  const view = netView(state, stickering);
  const width = NET_FACE * 4 + NET_GAP * 3;
  const height = NET_FACE * 3 + NET_GAP * 2;

  const faces: readonly { cells: Cell[]; column: number; row: number }[] = [
    { cells: view.up, column: 1, row: 0 },
    { cells: view.left, column: 0, row: 1 },
    { cells: view.front, column: 1, row: 1 },
    { cells: view.right, column: 2, row: 1 },
    { cells: view.back, column: 3, row: 1 },
    { cells: view.down, column: 1, row: 2 },
  ];

  const body = faces
    .map((face) =>
      face.cells
        .map((cell, index) =>
          rect(
            face.column * (NET_FACE + NET_GAP) + (index % 3) * NET_CELL + 0.6,
            face.row * (NET_FACE + NET_GAP) + Math.floor(index / 3) * NET_CELL + 0.6,
            NET_CELL - 1.2,
            NET_CELL - 1.2,
            1.5,
            colourOf(cell, skin),
            skin,
            0.7,
          ),
        )
        .join(''),
    )
    .join('');

  return svg(`0 0 ${width} ${height}`, body);
}

/* Isometric: the three faces you look at while solving. */

/**
 * Sized so the whole cube lands inside the 100x100 box: the drawing is three
 * cubies tall on the front plus one and a half of the tilted top, six units in
 * all, and 3 * √3 ≈ 5.2 units wide.
 */
const ISO_UNIT = 16;
const ISO_X: readonly [number, number] = [0.866, 0.5];
const ISO_Z: readonly [number, number] = [-0.866, 0.5];
const ISO_ORIGIN: readonly [number, number] = [50, 1.5 * ISO_UNIT + 2];

function point(u: number, v: number, w: number): string {
  const x = ISO_ORIGIN[0] + (ISO_X[0] * u + ISO_Z[0] * v) * ISO_UNIT;
  const y = ISO_ORIGIN[1] + (ISO_X[1] * u + ISO_Z[1] * v) * ISO_UNIT + w * ISO_UNIT;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function isometricSvg(state: CubeState, stickering: Stickering, skin: CubeSkin): string {
  const view = isometricView(state, stickering);
  const gap = 0.06;
  const size = 1 - gap * 2;

  /** Top face: rows run from the back of the cube towards the front. */
  const topCell = (index: number): string => {
    const u = (index % 3) - 1.5 + gap;
    const v = Math.floor(index / 3) - 1.5 + gap;
    return [
      point(u, v, 0),
      point(u + size, v, 0),
      point(u + size, v + size, 0),
      point(u, v + size, 0),
    ].join(' ');
  };

  /** Front face: across the cube and down it. */
  const frontCell = (index: number): string => {
    const u = (index % 3) - 1.5 + gap;
    const w = Math.floor(index / 3) + gap;
    return [
      point(u, 1.5, w),
      point(u + size, 1.5, w),
      point(u + size, 1.5, w + size),
      point(u, 1.5, w + size),
    ].join(' ');
  };

  /** Right face: its own column 0 is at the front of the cube. */
  const rightCell = (index: number): string => {
    const v = 1.5 - (index % 3) - 1 + gap;
    const w = Math.floor(index / 3) + gap;
    return [
      point(1.5, v, w),
      point(1.5, v + size, w),
      point(1.5, v + size, w + size),
      point(1.5, v, w + size),
    ].join(' ');
  };

  const body =
    view.top
      .map((cell, index) => polygon(topCell(index), colourOf(cell, skin), skin.outline, 0.8))
      .join('') +
    view.front
      .map((cell, index) =>
        polygon(frontCell(index), shade(colourOf(cell, skin), 0.88), skin.outline, 0.8),
      )
      .join('') +
    view.right
      .map((cell, index) =>
        polygon(rightCell(index), shade(colourOf(cell, skin), 0.74), skin.outline, 0.8),
      )
      .join('');

  return svg('0 0 100 100', body);
}
