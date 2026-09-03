import type { DiagramView } from '../../components/CubeDiagram';
import type { Stickering } from '../../domain/cube/views';

export interface Diagram {
  view: DiagramView;
  stickering: Stickering;
  /** What the animated player should dim, in cubing.js's own terms. */
  playerStickering: string;
}

/**
 * How each set is best looked at. Two-look sets differ per step: the first
 * look at OLL is about edges only, and the first look at PLL is about where
 * the corners go — showing everything would hide the one thing being read.
 *
 * Shared by the case list, the case sheet and the drill, so a case never
 * looks like two different cases depending on where you meet it.
 */
export function diagramFor(setId: string, group: string): Diagram {
  if (setId === '2look-oll') {
    return {
      view: 'lastLayer',
      stickering: group.includes('Edges') ? 'edgeOrientation' : 'orientation',
      playerStickering: 'OLL',
    };
  }
  if (setId === '2look-pll') {
    return {
      view: 'lastLayer',
      stickering: group.includes('Corners') ? 'corners' : 'edges',
      playerStickering: 'PLL',
    };
  }
  if (setId === 'oll') {
    return {
      view: 'lastLayer',
      stickering: 'orientation',
      playerStickering: 'OLL',
    };
  }
  if (setId === 'f2l') {
    return { view: 'isometric', stickering: 'pair', playerStickering: 'F2L' };
  }
  return { view: 'lastLayer', stickering: 'full', playerStickering: 'PLL' };
}
