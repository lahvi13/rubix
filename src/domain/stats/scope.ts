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
