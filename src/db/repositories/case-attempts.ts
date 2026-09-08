import Dexie from 'dexie';
import { db } from '../schema';
import type { Solve, SolveMode } from '../types';

/**
 * Reading attempts at one algorithm case. Shared by the two ways a case is
 * practised — solving it against the clock, and recognising it — because the
 * query is the same one and only the mode differs.
 *
 * Attempts are read across sessions on purpose: a case you drilled last month
 * is still a case you have drilled.
 */

/** Every attempt of one kind at one case, oldest first — averages are windows. */
export async function listAttempts(caseId: string, mode: SolveMode): Promise<Solve[]> {
  const solves = await db.solves
    .where('[caseId+createdAt]')
    .between([caseId, Dexie.minKey], [caseId, Dexie.maxKey])
    .toArray();
  return solves.filter((solve) => solve.mode === mode);
}

/**
 * The same for many cases at once, keyed by case. One pass over the caseId
 * index rather than a query per case — the OLL screen needs 57 of these to
 * draw its progress.
 */
export async function listAttemptsGrouped(
  caseIds: readonly string[],
  mode: SolveMode,
): Promise<Map<string, Solve[]>> {
  const grouped = new Map<string, Solve[]>(caseIds.map((caseId) => [caseId, []]));
  if (caseIds.length === 0) return grouped;

  const solves = await db.solves.where('caseId').anyOf([...caseIds]).toArray();
  for (const solve of solves) {
    if (solve.mode !== mode || solve.caseId === null) continue;
    grouped.get(solve.caseId)?.push(solve);
  }
  for (const attempts of grouped.values()) {
    attempts.sort((a, b) => a.createdAt - b.createdAt);
  }
  return grouped;
}
