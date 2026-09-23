import { db } from '../schema';
import { SPLITS_SCHEMA_VERSION, type Session, type Solve, type Split } from '../types';
import {
  csTimerSolveKey,
  type CsTimerPlan,
  type CsTimerSolve,
  type PlannedSession,
} from '../../domain/transfer/cstimer';
import { normaliseSplits } from '../../domain/solve/splits';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';
import { DEFAULT_METHOD_ID } from './session-repository';

/**
 * Bringing a csTimer export in. Two rules decide the shape of this file:
 *
 * - imported solves never join a session the user is timing into. Each
 *   csTimer session becomes a session of its own, under the name csTimer gave
 *   it, and none of them becomes the active one.
 * - a second import of the same file must change nothing. Duplicates are
 *   found by time and timestamp before anything is written, and a session
 *   whose solves are all duplicates is not created at all — otherwise every
 *   re-import would leave an empty session behind.
 */

/** How many rows go in per transaction. Enough to be fast, small enough to yield. */
const BATCH_SIZE = 250;

/**
 * Every solve already stored, as the key the planner compares against. One
 * pass over the table, without keeping the rows: an import is planned against
 * a whole history, which can be tens of thousands of solves.
 */
export async function readSolveKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  await db.solves.each((solve) => {
    keys.add(csTimerSolveKey(solve.rawMs, solve.startedAt));
  });
  return keys;
}

export interface ImportProgress {
  written: number;
  total: number;
}

/**
 * Writes the plan. Sessions first, then their solves in batches, so a phone
 * importing thousands of rows keeps painting — a single transaction over all
 * of them would block the main thread and, past a certain size, is the kind
 * of long Dexie transaction that commits early and fails (see CLAUDE.md).
 */
export async function applyCsTimerPlan(
  plan: CsTimerPlan,
  phaseKeys: readonly string[],
  onProgress?: (progress: ImportProgress) => void,
): Promise<number> {
  const total = plan.newSolves;
  let written = 0;
  onProgress?.({ written, total });

  for (const planned of plan.sessions) {
    if (planned.solves.length === 0) continue;

    const session = buildSession(planned);
    await db.sessions.add(session);

    for (let start = 0; start < planned.solves.length; start += BATCH_SIZE) {
      const batch = planned.solves
        .slice(start, start + BATCH_SIZE)
        .map((solve) => buildSolve(solve, session, phaseKeys));
      await db.solves.bulkPut(batch);
      written += batch.length;
      onProgress?.({ written, total });
    }
  }

  return written;
}

function buildSession(planned: PlannedSession): Session {
  const timestamp = now();
  return {
    id: createId(),
    name: planned.name,
    puzzle: planned.puzzle,
    mode: 'freestyle',
    methodId: DEFAULT_METHOD_ID,
    isArchived: 0,
    // Importing must not move the user off the session they are timing into.
    isActive: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildSolve(
  imported: CsTimerSolve,
  session: Session,
  phaseKeys: readonly string[],
): Solve {
  const splits = splitsOf(imported, phaseKeys);

  return {
    id: createId(),
    sessionId: session.id,
    puzzle: session.puzzle,
    mode: 'freestyle',
    caseId: null,
    scramble: imported.scramble,
    // csTimer does not say whether a scramble was typed in; nearly all are its own.
    scrambleSource: 'generated',
    rawMs: imported.rawMs,
    penalty: imported.penalty,
    // Not 'auto': that means this app's own inspection set it, and the screen
    // says so next to the time.
    penaltySource: 'manual',
    // csTimer does not export how long the inspection was.
    inspectionMs: null,
    startedAt: imported.startedAt,
    splits,
    splitsSchemaVersion: SPLITS_SCHEMA_VERSION,
    tagIds: [],
    note: imported.note,
    starred: 0,
    editedAt: null,
    // When the solve happened, not when it was imported — every list and every
    // rolling average is ordered by this.
    createdAt: imported.startedAt,
    updatedAt: now(),
  };
}

/**
 * Phase times only survive when csTimer timed the solve in as many phases as
 * this app's method has. A three-phase solve holds boundaries between phases
 * we cannot name, and guessing which of ours they are would be worse than
 * importing the solve without them.
 */
function splitsOf(imported: CsTimerSolve, phaseKeys: readonly string[]): Split[] {
  if (imported.phaseCount !== phaseKeys.length) return [];

  const splits: Split[] = imported.phaseEndsMs.map((atMs, index) => ({
    phase: phaseKeys[index] ?? '',
    atMs,
    source: 'manual',
  }));
  return normaliseSplits(splits, phaseKeys, imported.rawMs);
}
