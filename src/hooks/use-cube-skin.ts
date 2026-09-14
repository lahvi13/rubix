import { skinById, type CubeSkin } from '../lib/cube-skins';
import { useResolvedTheme } from './use-appearance';
import { useSetting } from './use-setting';

/** The palette every diagram in the app draws with, in the theme it draws on. */
export function useCubeSkin(): CubeSkin {
  const [id] = useSetting('ui.cubeSkin');
  return skinById(id, useResolvedTheme());
}
