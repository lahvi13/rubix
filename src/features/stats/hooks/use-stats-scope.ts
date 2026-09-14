import { useLiveQuery } from 'dexie-react-hooks';
import {
  getSetting,
  setSetting,
  STATS_SCOPES,
  type StatsScope,
} from '../../../db/repositories/settings-repository';
import { watchWrite } from '../../../lib/errors';

const KEY = 'stats.scope';

/**
 * Whose solves the stats read, or undefined until the setting has been read.
 * Not useSetting: its default stands in while the read is under way, and for
 * somebody who reads one session that meant every number on the screen
 * computed twice and shown wrong in between.
 */
export function useStatsScope(): [StatsScope | undefined, (scope: StatsScope) => void] {
  const stored = useLiveQuery(() => getSetting(KEY), []);
  // A string from a newer version, or from an import, is only trusted if it
  // is one this version knows how to draw.
  const scope =
    stored === undefined ? undefined : STATS_SCOPES.find((known) => known === stored) ?? 'all';
  return [scope, (next) => watchWrite(() => setSetting(KEY, next), KEY)];
}
