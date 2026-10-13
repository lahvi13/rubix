import { useLiveQuery } from 'dexie-react-hooks';
import type { Method } from '../../../db/types';
import { listMethods } from '../../../db/repositories/method-repository';
import { DEFAULT_METHOD_ID, getActiveSession } from '../../../db/repositories/session-repository';

/**
 * The method the guide opens on: the one the reader is timing in. Somebody
 * who has started a Roux session wants Roux explained; everybody else meets
 * the guide as it always was. Undefined until the database has answered.
 *
 * The 3×3's, whichever cube the app is on: another cube's guides are not
 * methods a session is timed in, so its answer is simply not one of them.
 */
export function useActiveMethodId(): string | undefined {
  return useLiveQuery(
    async () => (await getActiveSession('333', 'freestyle'))?.methodId ?? DEFAULT_METHOD_ID,
    [],
  );
}

/** The methods, for naming the guide's switch. */
export function useMethodList(): Method[] | undefined {
  return useLiveQuery(listMethods, []);
}
