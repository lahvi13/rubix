import { useEffect, type RefObject } from 'react';
import { skinById } from '../lib/cube-skins';
import { paintCube, type PaintOptions } from '../lib/twisty-skin';
import type { TwistyPlayerElement } from '../types/twisty';
import { useResolvedTheme } from './use-appearance';
import { useSetting } from './use-setting';

/** Paints the player's cube in the reader's skin, and again when it changes. */
export function useTwistySkin(
  player: RefObject<TwistyPlayerElement | null>,
  isReady: boolean,
  { shadeStrength }: PaintOptions = {},
): void {
  const [skinId] = useSetting('ui.cubeSkin');
  const theme = useResolvedTheme();

  useEffect(() => {
    if (!isReady) return;
    const element = player.current;
    // Deprecated in cubing.js; a version without it keeps its own colours.
    if (typeof element?.experimentalCurrentThreeJSPuzzleObject !== 'function') return;

    let cancelled = false;
    void element.experimentalCurrentThreeJSPuzzleObject().then((cube) => {
      if (!cancelled) paintCube(cube, skinById(skinId, theme), { shadeStrength });
    });
    return () => {
      cancelled = true;
    };
  }, [isReady, player, skinId, theme, shadeStrength]);
}
