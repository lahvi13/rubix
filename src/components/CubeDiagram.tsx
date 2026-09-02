import { memo } from 'react';
import type { CubeState } from '../domain/cube/state';
import {
  isometricView,
  lastLayerView,
  type Cell,
  type Stickering,
} from '../domain/cube/views';
import { DEFAULT_CUBE_SKIN, type CubeSkin } from '../lib/cube-skins';

export type DiagramView = 'lastLayer' | 'isometric';

interface CubeDiagramProps {
  state: CubeState;
  view: DiagramView;
  stickering?: Stickering;
  skin?: CubeSkin;
  /**
   * Read out instead of the picture. Pass null where the diagram sits inside
   * something already labelled — a card that names the case underneath does
   * not want its name read twice.
   */
  label: string | null;
  className?: string;
}

/**
 * Draws a case as SVG from a cube state.
 *
 * Not a <twisty-player>: a set screen shows fifty-seven of these at once, and
 * fifty-seven custom elements each loading a puzzle would make the phone
 * useless. This is also the only way to give the cube a skin — the player
 * paints its own colours.
 */
export const CubeDiagram = memo(function CubeDiagram({
  state,
  view,
  stickering = 'full',
  skin = DEFAULT_CUBE_SKIN,
  label,
  className,
}: CubeDiagramProps) {
  return view === 'lastLayer' ? (
    <LastLayerDiagram
      state={state}
      stickering={stickering}
      skin={skin}
      label={label}
      className={className}
    />
  ) : (
    <IsometricDiagram
      state={state}
      stickering={stickering}
      skin={skin}
      label={label}
      className={className}
    />
  );
});

interface DiagramProps {
  state: CubeState;
  stickering: Stickering;
  skin: CubeSkin;
  label: string | null;
  className?: string;
}

/* Last layer: the top face with the four strips of side stickers around it. */

const CELL = 20;
const STRIP = 10;
const OFFSET = STRIP + 2;
const SIZE = OFFSET * 2 + CELL * 3;
const INSET = 1;

function LastLayerDiagram({ state, stickering, skin, label, className }: DiagramProps) {
  const view = lastLayerView(state, stickering);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      {...labelProps(label)}
      focusable="false"
    >
      {view.top.map((cell, index) => (
        <rect
          key={`top-${index}`}
          x={OFFSET + (index % 3) * CELL + INSET}
          y={OFFSET + Math.floor(index / 3) * CELL + INSET}
          width={CELL - INSET * 2}
          height={CELL - INSET * 2}
          rx={2}
          fill={colourOf(cell, skin)}
          stroke={skin.outline}
          strokeWidth={1}
        />
      ))}

      {view.back.map((cell, index) => (
        <Strip key={`back-${index}`} cell={cell} skin={skin} horizontal index={index} at={0} />
      ))}
      {view.front.map((cell, index) => (
        <Strip
          key={`front-${index}`}
          cell={cell}
          skin={skin}
          horizontal
          index={index}
          at={SIZE - STRIP}
        />
      ))}
      {view.left.map((cell, index) => (
        <Strip key={`left-${index}`} cell={cell} skin={skin} index={index} at={0} />
      ))}
      {view.right.map((cell, index) => (
        <Strip key={`right-${index}`} cell={cell} skin={skin} index={index} at={SIZE - STRIP} />
      ))}
    </svg>
  );
}

interface StripProps {
  cell: Cell;
  skin: CubeSkin;
  index: number;
  /** Distance from the edge of the picture: 0 for top and left. */
  at: number;
  horizontal?: boolean;
}

function Strip({ cell, skin, index, at, horizontal = false }: StripProps) {
  const along = OFFSET + index * CELL + INSET;
  const length = CELL - INSET * 2;

  return (
    <rect
      x={horizontal ? along : at}
      y={horizontal ? at : along}
      width={horizontal ? length : STRIP}
      height={horizontal ? STRIP : length}
      rx={2}
      fill={colourOf(cell, skin)}
      stroke={skin.outline}
      strokeWidth={1}
    />
  );
}

/* Isometric: the three faces you look at while solving. */

const ISO_UNIT = 26;
const ISO_X: readonly [number, number] = [0.866, 0.5];
const ISO_Z: readonly [number, number] = [-0.866, 0.5];
const ISO_ORIGIN: readonly [number, number] = [50, 8];

function point(u: number, v: number, w: number): string {
  const x = ISO_ORIGIN[0] + (ISO_X[0] * u + ISO_Z[0] * v) * ISO_UNIT;
  const y = ISO_ORIGIN[1] + (ISO_X[1] * u + ISO_Z[1] * v) * ISO_UNIT + w * ISO_UNIT;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function IsometricDiagram({ state, stickering, skin, label, className }: DiagramProps) {
  const view = isometricView(state, stickering);
  const gap = 0.06;

  /** Top face: rows run from the back of the cube towards the front. */
  const topCell = (index: number): string => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const u = column - 1.5 + gap;
    const v = row - 1.5 + gap;
    const size = 1 - gap * 2;
    return [
      point(u, v, 0),
      point(u + size, v, 0),
      point(u + size, v + size, 0),
      point(u, v + size, 0),
    ].join(' ');
  };

  /** Front face: across the cube and down it. */
  const frontCell = (index: number): string => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const u = column - 1.5 + gap;
    const w = row + gap;
    const size = 1 - gap * 2;
    return [
      point(u, 1.5, w),
      point(u + size, 1.5, w),
      point(u + size, 1.5, w + size),
      point(u, 1.5, w + size),
    ].join(' ');
  };

  /** Right face: its own column 0 is at the front of the cube. */
  const rightCell = (index: number): string => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const v = 1.5 - column - 1 + gap;
    const w = row + gap;
    const size = 1 - gap * 2;
    return [
      point(1.5, v, w),
      point(1.5, v + size, w),
      point(1.5, v + size, w + size),
      point(1.5, v, w + size),
    ].join(' ');
  };

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      {...labelProps(label)}
      focusable="false"
    >
      {view.top.map((cell, index) => (
        <polygon
          key={`top-${index}`}
          points={topCell(index)}
          fill={colourOf(cell, skin)}
          stroke={skin.outline}
          strokeWidth={0.8}
        />
      ))}
      {view.front.map((cell, index) => (
        <polygon
          key={`front-${index}`}
          points={frontCell(index)}
          fill={shade(colourOf(cell, skin), 0.88)}
          stroke={skin.outline}
          strokeWidth={0.8}
        />
      ))}
      {view.right.map((cell, index) => (
        <polygon
          key={`right-${index}`}
          points={rightCell(index)}
          fill={shade(colourOf(cell, skin), 0.74)}
          stroke={skin.outline}
          strokeWidth={0.8}
        />
      ))}
    </svg>
  );
}

/** A named picture, or one the screen reader should walk straight past. */
function labelProps(label: string | null) {
  return label === null
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);
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
