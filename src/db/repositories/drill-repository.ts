import Dexie from 'dexie';
import { db } from '../schema';
import type { Penalty, Puzzle, Solve } from '../types';
import { drillPool } from '../../domain/drill/selection';
import { now } from '../../lib/clock';
import { listAttempts, listAttemptsGrouped } from './case-attempts';
import { listCasesWithAlgs, markCaseLearning, type CaseWithAlg } from './alg-repository';
import { getOrCreateActiveSession } from './session-repository';
import { addSolve, deleteSolves } from './solve-repository';

/**
 * Drill attempts. They are ordinary solves — same table, same timer, same
 * penalties — told apart by `mode: 'drill'` and the case they belong to, and
 * kept out of the main statistics by living in their own session (SPEC 3.5).
 */

/** What the drill screen supplies; the repository owns ids and timestamps. */
export interface NewDrillSolve {
  puzzle: Puzzle;
  caseId: string;
  scramble: string;
  rawMs: number;
  penalty: Penalty;
  penaltySource: Solve['penaltySource'];
  inspectionMs: number | null;
  startedAt: number;
}

/**
 * Stores one attempt. Drills go to the puzzle's drill session, which is a
 * separate active session from the freestyle one — that is the whole reason
 * a session carries a mode, and it is what keeps a drilled T perm out of
 * somebody's ao100.
 */
export async function addDrillSolve(input: NewDrillSolve): Promise<Solve> {
  const session = await getOrCreateActiveSession(input.puzzle, 'drill');
  const solve = await addSolve({
    sessionId: session.id,
    puzzle: input.puzzle,
    mode: 'drill',
    caseId: input.caseId,
    scramble: input.scramble,
    rawMs: input.rawMs,
    penalty: input.penalty,
    penaltySource: input.penaltySource,
    inspectionMs: input.inspectionMs,
    startedAt: input.startedAt,
  });
  // After the attempt, which is what must not be lost: the step is a courtesy.
  await markCaseLearning(input.caseId);
  return solve;
}

/** Every timed attempt at one case, oldest first. */
export async function listCaseAttempts(caseId: string): Promise<Solve[]> {
  return listAttempts(caseId, 'drill');
}

/** The same for a whole set at once, keyed by case. */
export async function listAttemptsByCase(
  caseIds: readonly string[],
): Promise<Map<string, Solve[]>> {
  return listAttemptsGrouped(caseIds, 'drill');
}

/**
 * The cases a drill draws from: the set, narrowed to the user's selection,
 * each with the algorithm it is drilled with. Selecting nothing drills
 * everything (see drillPool).
 */
export async function loadDrillPool(
  setId: string,
  selectedIds: readonly string[] | null = null,
): Promise<CaseWithAlg[]> {
  const cases = await listCasesWithAlgs(setId);
  const wanted = drillPool(
    cases.map((entry) => ({ id: entry.algCase.id })),
    selectedIds,
  );
  const ids = new Set(wanted.map((entry) => entry.id));
  return cases.filter((entry) => ids.has(entry.algCase.id));
}

/**
 * Throws away everything drilled on one case — for when the numbers describe
 * a week when you did not know the algorithm yet, and you would rather start
 * again than wait for the average to forget.
 */
export async function deleteCaseAttempts(caseId: string): Promise<Solve[]> {
  const attempts = await listCaseAttempts(caseId);
  return deleteSolves(attempts.map((solve) => solve.id));
}

/**
 * Lets go of a case that no longer exists, leaving the attempts themselves
 * alone. A drill solve is a time somebody actually got; deleting a custom
 * case must not delete their history with it (SPEC 4.3).
 */
export async function detachCase(caseId: string): Promise<void> {
  const timestamp = now();
  await db.solves
    .where('[caseId+createdAt]')
    .between([caseId, Dexie.minKey], [caseId, Dexie.maxKey])
    .modify({ caseId: null, updatedAt: timestamp });
}
