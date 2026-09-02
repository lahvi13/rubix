import { memo } from 'react';
import type { CubeState } from '../domain/cube/state';
import {
  isometricView,
  lastLayerView,
  netView,
  permutationArrows,
  type Cell,
  type PieceArrow,
  type Stickering,
} from '../domain/cube/views';
import { DEFAULT_CUBE_SKIN, type CubeSkin } from '../lib/cube-skins';

export type DiagramView = 'lastLayer' | 'isometric' | 'net';

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
  const props = { state, stickering, skin, label, className };

  if (view === 'lastLayer') return <LastLayerDiagram {...props} />;
  if (view === 'net') return <NetDiagram {...props} />;
  return <IsometricDiagram {...props} />;
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
      {permutationArrows(state, stickering).map((arrow) => (
        <Arrow key={`${arrow.from}-${arrow.to}`} arrow={arrow} skin={skin} />
      ))}
    </svg>
  );
}

/** Centre of a cell of the top-face grid. */
function cellCentre(cell: number): readonly [number, number] {
  return [
    OFFSET + ((cell % 3) + 0.5) * CELL,
    OFFSET + (Math.floor(cell / 3) + 0.5) * CELL,
  ];
}

/**
 * Where a piece has to go. Drawn short of both cells so the arrow sits between
 * the stickers rather than on top of them, and double-headed for a swap.
 */
function Arrow({ arrow, skin }: { arrow: PieceArrow; skin: CubeSkin }) {
  const [fromX, fromY] = cellCentre(arrow.from);
  const [toX, toY] = cellCentre(arrow.to);
  const length = Math.hypot(toX - fromX, toY - fromY);
  const unitX = (toX - fromX) / length;
  const unitY = (toY - fromY) / length;

  const inset = CELL * 0.17;
  const startX = fromX + unitX * inset;
  const startY = fromY + unitY * inset;
  const endX = toX - unitX * inset;
  const endY = toY - unitY * inset;

  const head = (x: number, y: number, towardsX: number, towardsY: number): string => {
    const size = 5.6;
    const wingX = -towardsY * size * 0.62;
    const wingY = towardsX * size * 0.62;
    return [
      `${x},${y}`,
      `${x - towardsX * size + wingX},${y - towardsY * size + wingY}`,
      `${x - towardsX * size - wingX},${y - towardsY * size - wingY}`,
    ].join(' ');
  };

  const shaft = (width: number, colour: string) => (
    <line
      x1={startX}
      y1={startY}
      x2={endX}
      y2={endY}
      stroke={colour}
      strokeWidth={width}
      strokeLinecap="round"
    />
  );

  const heads = (colour: string, outline: number) => (
    <>
      <polygon
        points={head(endX, endY, unitX, unitY)}
        fill={colour}
        stroke={colour}
        strokeWidth={outline}
        strokeLinejoin="round"
      />
      {arrow.isSwap ? (
        <polygon
          points={head(startX, startY, -unitX, -unitY)}
          fill={colour}
          stroke={colour}
          strokeWidth={outline}
          strokeLinejoin="round"
        />
      ) : null}
    </>
  );

  // Drawn twice: a dark outline underneath, so the arrow stays visible over a
  // yellow sticker as well as over a grey one.
  return (
    <g className="diagram-arrow">
      {shaft(4.6, skin.outline)}
      {heads(skin.outline, 2.4)}
      {shaft(2.4, skin.arrow)}
      {heads(skin.arrow, 0)}
    </g>
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

/* Net: the cube unfolded, for looking a scramble over. */

const NET_CELL = 12;
const NET_FACE = NET_CELL * 3;
const NET_GAP = 2;

function NetDiagram({ state, stickering, skin, label, className }: DiagramProps) {
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

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      {...labelProps(label)}
      focusable="false"
    >
      {faces.map((face, faceIndex) =>
        face.cells.map((cell, index) => (
          <rect
            key={`${faceIndex}-${index}`}
            x={face.column * (NET_FACE + NET_GAP) + (index % 3) * NET_CELL + 0.6}
            y={face.row * (NET_FACE + NET_GAP) + Math.floor(index / 3) * NET_CELL + 0.6}
            width={NET_CELL - 1.2}
            height={NET_CELL - 1.2}
            rx={1.5}
            fill={colourOf(cell, skin)}
            stroke={skin.outline}
            strokeWidth={0.7}
          />
        )),
      )}
    </svg>
  );
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
