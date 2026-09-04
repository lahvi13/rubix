import { memo } from 'react';
import type { CubeState } from '../domain/cube/state';
import type { Stickering } from '../domain/cube/views';
import type { CubeSkin } from '../lib/cube-skins';
import { diagramUrl, type DiagramView } from './cube-diagram-svg';

export type { DiagramView };

interface CubeDiagramProps {
  state: CubeState;
  view: DiagramView;
  stickering?: Stickering;
  skin: CubeSkin;
  /**
   * Read out instead of the picture. Pass null where the diagram sits inside
   * something already labelled — a card that names the case underneath does
   * not want its name read twice.
   */
  label: string | null;
  className?: string;
}

/**
 * A case as a picture, drawn from a cube state.
 *
 * Not a <twisty-player>: a set screen shows fifty-seven of these at once, and
 * fifty-seven custom elements each loading a puzzle would make the phone
 * useless. This is also the only way to give the cube a skin — the player
 * paints its own colours.
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
  label,
  className,
}: CubeDiagramProps) {
  return (
    <img
      className={className}
      src={diagramUrl(state, view, stickering, skin)}
      alt={label ?? ''}
      draggable={false}
      // Fifty-seven pictures arriving at once are fifty-seven decodes; off the
      // main thread, and only for the ones actually on screen.
      loading="lazy"
      decoding="async"
    />
  );
});
