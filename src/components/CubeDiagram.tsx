import { memo } from 'react';
import type { CubeState } from '../domain/cube/state';
import type { Stickering } from '../domain/cube/views';
import type { CubeSkin } from '../lib/cube-skins';
import { diagramUrl, type DiagramView, type MarkedCorner } from './cube-diagram-svg';

export type { DiagramView, MarkedCorner };

interface CubeDiagramProps {
  state: CubeState;
  view: DiagramView;
  stickering?: Stickering;
  skin: CubeSkin;
  /** A corner framed for the reader to look at; last-layer pictures only. */
  mark?: MarkedCorner | null;
  /**
   * Read out instead of the picture. Pass null where the diagram sits inside
   * something already labelled — a card that names the case underneath does
   * not want its name read twice.
   */
  label: string | null;
  className?: string;
  /**
   * Load at once rather than when scrolled to. For a picture that is on
   * screen from the start and is the largest thing there — lazy loading it
   * only delays the moment the page looks ready.
   */
  isEager?: boolean;
}

/**
 * A case as a picture, drawn from a cube state.
 *
 * Not a <twisty-player>: a set screen shows fifty-seven of these at once, and
 * fifty-seven custom elements each loading a puzzle would make the phone
 * useless.
 *
 * The picture is an image rather than a tree of elements, because the tree is
 * what cost the phone its seconds; see cube-diagram-svg.ts, which builds and
 * keeps them.
 */
export const CubeDiagram = memo(function CubeDiagram({
  state,
  view,
  stickering = 'full',
  skin,
  mark = null,
  label,
  className,
  isEager = false,
}: CubeDiagramProps) {
  return (
    <img
      className={className}
      src={diagramUrl(state, view, stickering, skin, mark)}
      alt={label ?? ''}
      draggable={false}
      // Fifty-seven pictures arriving at once are fifty-seven decodes; off the
      // main thread, and only for the ones actually on screen.
      loading={isEager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
});
