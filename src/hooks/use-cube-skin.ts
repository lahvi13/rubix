import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, SETTING_DEFAULTS } from '../db/repositories/settings-repository';
import { skinById, type CubeSkin } from '../lib/cube-skins';
import { useResolvedTheme } from './use-theme';

/** The palette every diagram in the app draws with, in the theme it draws on. */
export function useCubeSkin(): CubeSkin {
  const id = useLiveQuery(() => getSetting('ui.cubeSkin'), [], SETTING_DEFAULTS['ui.cubeSkin']);
  return skinById(id, useResolvedTheme());
}
