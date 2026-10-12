import { useLiveQuery } from 'dexie-react-hooks';
import type { Session } from '../../../db/types';
import { getMethod } from '../../../db/repositories/method-repository';
import { listSessions } from '../../../db/repositories/session-repository';

/**
 * What a session's method is called, where that needs saying: once the
 * sessions in use are timed in more than one. A session need not be named
 * after its method, and the method decides what a personal best is and whose
 * solves the stats read. With every session in the same method it would be
 * the same word after every solve, so there is none — the rule the session
 * picker names its rows by.
 *
 * null then, and while the answer is not in yet.
 */
export function useMethodLabel(session: Session | null): string | null {
  const label = useLiveQuery(async () => {
    if (session === null) return null;
    const inUse = (await listSessions(false, session.mode)).filter(
      (other) => other.puzzle === session.puzzle,
    );
    if (inUse.every((other) => other.methodId === session.methodId)) return null;
    return (await getMethod(session.methodId))?.name ?? null;
  }, [session?.id, session?.methodId, session?.puzzle, session?.mode]);
  return label ?? null;
}
