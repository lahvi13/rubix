import type { Puzzle, Solve } from '../types';
import { listAttempts, listAttemptsGrouped } from './case-attempts';
import { getOrCreateActiveSession } from './session-repository';
import { addSolve, deleteSolves } from './solve-repository';

/**
 * Recognition attempts: how long it took to tell which case is on the cube,
 * with nothing solved and no cube needed.
 *
 * Stored the way drills are — ordinary solves in the same table, told apart by
 * `mode: 'recognition'` and living in their own active session — so penalties,
 * tombstones, export and the per-case statistics all work on them unchanged.
 * The third mode is what keeps a two-second recognition out of the drill's
 * ao5, where it would look like a very fast PLL.
 *
 * A wrong answer is a DNF. That is the same bargain the drill makes for a
 * case that was looked up: the attempt happened and has to be counted, but it
 * cannot count as a time. Which case was answered instead is deliberately not
 * kept — it would be a new field on every solve for one screen's benefit, and
 * the confusion it would describe is already visible as a case's DNF rate.
 */

/** What the screen supplies; the repository owns ids and timestamps. */
export interface NewRecognitionAttempt {
  puzzle: Puzzle;
  caseId: string;
  /** The setup the picture was drawn from, so a round can be reconstructed. */
  scramble: string;
  /** Time from the case appearing to the answer, integer milliseconds. */
  rawMs: number;
  isCorrect: boolean;
  startedAt: number;
}

export async function addRecognitionAttempt(input: NewRecognitionAttempt): Promise<Solve> {
  const session = await getOrCreateActiveSession(input.puzzle, 'recognition');
  return addSolve({
    sessionId: session.id,
    puzzle: input.puzzle,
    mode: 'recognition',
    caseId: input.caseId,
    scramble: input.scramble,
    rawMs: input.rawMs,
    penalty: input.isCorrect ? 'none' : 'dnf',
    // The app judged it, not the user: there is no cube to have been dropped.
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: input.startedAt,
  });
}

/** Every recognition attempt at one case, oldest first. */
export async function listCaseRecognitions(caseId: string): Promise<Solve[]> {
  return listAttempts(caseId, 'recognition');
}

/** The same for a whole set at once, keyed by case. */
export async function listRecognitionsByCase(
  caseIds: readonly string[],
): Promise<Map<string, Solve[]>> {
  return listAttemptsGrouped(caseIds, 'recognition');
}

/**
 * Throws away everything recognised on one case, leaving its drills alone —
 * the two are separate practice and are forgotten separately.
 */
export async function deleteCaseRecognitions(caseId: string): Promise<Solve[]> {
  const attempts = await listCaseRecognitions(caseId);
  return deleteSolves(attempts.map((solve) => solve.id));
}
