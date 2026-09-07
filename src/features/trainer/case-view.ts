import type { DiagramView } from '../../components/CubeDiagram';
import type { PlayerStickering } from './components/CasePlayer';
import type { Stickering } from '../../domain/cube/views';

export interface Diagram {
  view: DiagramView;
  stickering: Stickering;
  /**
   * What the animated cube shows.
   *
   * Dimming costs a cube its colours — cubing.js darkens them rather than
   * greying them, so blue turns to navy and yellow to olive — and that is only
   * worth paying where half the cube would otherwise be noise. On the last
   * layer it is not: the case is the layer being turned, and the eye finds it
   * without help.
   */
  playerStickering: PlayerStickering;
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
      playerStickering: 'full',
    };
  }
  if (setId === '2look-pll') {
    return {
      view: 'lastLayer',
      stickering: group.includes('Corners') ? 'corners' : 'edges',
      playerStickering: 'full',
    };
  }
  if (setId === 'oll') {
    return {
      view: 'lastLayer',
      stickering: 'orientation',
      playerStickering: 'full',
    };
  }
  // The one set where dimming earns its cost: an F2L case is two pieces in a
  // whole cube, and without the rest going quiet there is nothing to look at.
  if (setId === 'f2l') {
    return { view: 'isometric', stickering: 'firstTwoLayers', playerStickering: 'firstTwoLayers' };
  }
  return { view: 'lastLayer', stickering: 'full', playerStickering: 'full' };
}
