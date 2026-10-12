/**
 * Which of the loaded solves the stats read. The tag comes first and the
 * latest-n cut second: "my last hundred one-handed solves" is the question a
 * tag is made to answer, and cutting first would leave a handful of them.
 */
export interface Scoped<T> {
  /** Everything the tag lets through, before the latest-n cut. */
  pool: T[];
  /** What the numbers are computed over. */
  read: T[];
}

/**
 * The solves timed in one method, out of solves that may come from sessions of
 * several. Phases belong to a method: a table of Roux's four over solves that
 * were split into CFOP's four has nothing to put in its columns — and where
 * two methods happen to share a phase's name, as CFOP and ZZ share F2L, it
 * has the wrong thing to put there.
 *
 * A solve whose session is not known is left out with the rest.
 */
export function solvesOfMethod<T extends { sessionId: string }>(
  solves: readonly T[],
  /** Each session's method, by the session's id. */
  methodOfSession: ReadonlyMap<string, string>,
  methodId: string | null,
): T[] {
  if (methodId === null) return [];
  return solves.filter((solve) => methodOfSession.get(solve.sessionId) === methodId);
}

export function solvesInScope<T extends { tagIds: readonly string[] }>(
  /** Chronological, oldest first. */
  loaded: readonly T[],
  tagId: string | null,
  /** null reads the whole pool. */
  latest: number | null,
): Scoped<T> {
  const pool = tagId === null ? [...loaded] : loaded.filter((solve) => solve.tagIds.includes(tagId));
  return { pool, read: latest === null ? pool : pool.slice(-latest) };
}
