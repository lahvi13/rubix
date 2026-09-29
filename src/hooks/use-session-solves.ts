import { useLiveQuery } from 'dexie-react-hooks';
import type { Solve } from '../db/types';
import { listSolvesChronological } from '../db/repositories/solve-repository';

/**
 * Every solve of a session, oldest first, live. Undefined until the first
 * read lands.
 *
 * A screen that needs the session's solves for more than one thing reads them
 * here once and hands the array on: a live query pays for every row it
 * returns — each is cloned and its key tracked — and with thousands of solves
 * two queries over the same session were twice that, after every solve.
 */
export function useSessionSolves(sessionId: string | null): Solve[] | undefined {
  return useLiveQuery(
    async () => (sessionId === null ? [] : listSolvesChronological(sessionId)),
    [sessionId],
  );
}
