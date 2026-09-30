import type { DiagramView } from '../../components/CubeDiagram';
import { BEGINNER_GROUPS, BEGINNER_SET_ID, LEVEL_BASE_SETS } from '../../domain/alg/sets';
import type { PlayerStickering } from './components/CasePlayer';
import type { Stickering } from '../../domain/cube/views';

export interface Diagram {
  view: DiagramView;
  stickering: Stickering;
  /**
   * What the animated cube shows. Greyed stickers wear the skin's muted colour
   * (`lib/twisty-skin.ts`), the same grey the still picture uses, so the cube
   * that replaces a picture keeps what the picture chose to show — as far as
   * a cube that also has sides can. PLL shows everything: the side colours
   * are what the case is read by.
   */
  playerStickering: PlayerStickering;
  /**
   * How the cube is stood before the case is set up, as a whole-cube rotation.
   *
   * It changes which colours end up on which faces and nothing else — the
   * setup that follows names faces, so the case is built in the same slot
   * whichever way the cube was turned first. Empty for the last layer, which
   * is read from above and shows barely any side colour at all.
   */
  orientation: string;
}

/**
 * The first two layers, met with red in front instead of green.
 *
 * A case down here is read off the two faces beside the slot, and green next
 * to orange is the one pair of neighbours on the cube that shares a hue — at
 * the size of a card the two ran together. Turning the cube a quarter to the
 * left puts red beside green there, which is as far apart as two adjacent
 * faces get in every skin and both themes.
 */
export const F2L_ORIENTATION = "y'";

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
      playerStickering: 'orientation',
      orientation: '',
    };
  }
  if (setId === '2look-pll') {
    return {
      view: 'lastLayer',
      stickering: group.includes('Corners') ? 'corners' : 'edges',
      playerStickering: 'full',
      orientation: '',
    };
  }
  if (setId === 'oll') {
    return {
      view: 'lastLayer',
      stickering: 'orientation',
      playerStickering: 'orientation',
      orientation: '',
    };
  }
  if (setId === BEGINNER_SET_ID) {
    // Each step of the guide is looked at from where that step happens: down
    // at the layer being built, or at the last layer with only the pieces the
    // step moves left in colour.
    if (group === BEGINNER_GROUPS.corners) {
      return {
        view: 'isometric',
        stickering: 'bottomLayer',
        playerStickering: 'firstTwoLayers',
        orientation: F2L_ORIENTATION,
      };
    }
    if (group === BEGINNER_GROUPS.edges) {
      return {
        view: 'isometric',
        stickering: 'firstTwoLayers',
        playerStickering: 'firstTwoLayers',
        orientation: F2L_ORIENTATION,
      };
    }
    return {
      view: 'lastLayer',
      stickering: group === BEGINNER_GROUPS.cornersHome ? 'corners' : 'edges',
      playerStickering: 'full',
      orientation: '',
    };
  }
  // The sets where dimming earns its cost: a case down here is a piece or two
  // in a whole cube, and without the rest going quiet there is nothing to look
  // at. F2L is drawn the same way however far into it the case is — the
  // advanced and expert levels are the same picture with a second slot in it.
  if (setId === 'f2l' || Object.hasOwn(LEVEL_BASE_SETS, setId) || setId === BEGINNER_SET_ID) {
    return {
      view: 'isometric',
      stickering: 'firstTwoLayers',
      playerStickering: 'firstTwoLayers',
      orientation: F2L_ORIENTATION,
    };
  }
  return { view: 'lastLayer', stickering: 'full', playerStickering: 'full', orientation: '' };
}
