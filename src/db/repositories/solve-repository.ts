import Dexie from 'dexie';
import { db } from '../schema';
import { SPLITS_SCHEMA_VERSION, type Penalty, type Solve } from '../types';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';

/** Everything a caller must supply; the repository owns ids and timestamps. */
export interface NewSolve {
  sessionId: string;
  puzzle: Solve['puzzle'];
  mode: Solve['mode'];
  caseId?: string | null;
  scramble: string;
  rawMs: number;
  penalty: Penalty;
  penaltySource: Solve['penaltySource'];
  inspectionMs: number | null;
  startedAt: number;
}

export async function addSolve(input: NewSolve): Promise<Solve> {
  const timestamp = now();
  const solve: Solve = {
    id: createId(),
    sessionId: input.sessionId,
    puzzle: input.puzzle,
    mode: input.mode,
    caseId: input.caseId ?? null,
    scramble: input.scramble,
    rawMs: Math.round(input.rawMs),
    penalty: input.penalty,
    penaltySource: input.penaltySource,
    inspectionMs: input.inspectionMs === null ? null : Math.round(input.inspectionMs),
    startedAt: input.startedAt,
    splits: [],
    splitsSchemaVersion: SPLITS_SCHEMA_VERSION,
    tagIds: [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.solves.add(solve);
  return solve;
}

export async function listRecentSolves(sessionId: string, limit: number): Promise<Solve[]> {
  return db.solves
    .where('[sessionId+createdAt]')
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
}

/** Manual penalty change from the UI. Always marks the solve as edited. */
export async function setPenalty(id: string, penalty: Penalty): Promise<void> {
  const timestamp = now();
  await db.solves.update(id, {
    penalty,
    penaltySource: 'manual',
    editedAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Deleting always leaves a tombstone, otherwise a later import resurrects the row. */
export async function deleteSolve(id: string): Promise<void> {
  await db.transaction('rw', db.solves, db.tombstones, async () => {
    await db.solves.delete(id);
    await db.tombstones.put({ id, table: 'solves', deletedAt: now() });
  });
}
