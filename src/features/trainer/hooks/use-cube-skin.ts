import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting } from '../../../db/repositories/settings-repository';
import { DEFAULT_CUBE_SKIN, skinById, type CubeSkin } from '../../../lib/cube-skins';

/** The palette every diagram in the app draws with. */
export function useCubeSkin(): CubeSkin {
  const id = useLiveQuery(() => getSetting('ui.cubeSkin'), [], DEFAULT_CUBE_SKIN.id);
  return skinById(id);
}
