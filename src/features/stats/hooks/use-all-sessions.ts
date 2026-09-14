import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, setSetting } from '../../../db/repositories/settings-repository';
import { watchWrite } from '../../../lib/errors';

const KEY = 'stats.allSessions';

/**
 * Whether the stats read every session, or undefined until the setting has
 * been read. Not useSetting: its default stands in while the read is under
 * way, and for somebody who reads one session that meant every number on the
 * screen computed twice and shown wrong in between.
 */
export function useAllSessions(): [boolean | undefined, (value: boolean) => void] {
  const value = useLiveQuery(() => getSetting(KEY), []);
  return [value, (next) => watchWrite(() => setSetting(KEY, next), KEY)];
}
