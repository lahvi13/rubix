import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { getOrCreateActiveSession } from './session-repository';
import { addSolve, deleteSolve, listRecentSolves, setPenalty } from './solve-repository';
import type { NewSolve } from './solve-repository';

async function makeSolve(sessionId: string, rawMs: number): Promise<NewSolve> {
  return {
    sessionId,
    puzzle: '333',
    mode: 'freestyle',
    scramble: "R U R' U'",
    rawMs,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: 9000,
    startedAt: Date.now(),
  };
}

describe('solve repository', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    const session = await getOrCreateActiveSession('333', 'freestyle');
    sessionId = session.id;
  });

  it('stores a solve with defaults the caller never has to supply', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345));

    expect(solve.id).toBeTruthy();
    expect(solve.splits).toEqual([]);
    expect(solve.tagIds).toEqual([]);
    expect(solve.starred).toBe(0);
    expect(solve.editedAt).toBeNull();
    expect(solve.createdAt).toBe(solve.updatedAt);
  });

  it('rounds the raw time to whole milliseconds', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345.678));
    expect(solve.rawMs).toBe(12_346);
  });

  it('lists the newest solves first', async () => {
    await addSolve(await makeSolve(sessionId, 1000));
    await addSolve(await makeSolve(sessionId, 2000));
    await addSolve(await makeSolve(sessionId, 3000));

    const recent = await listRecentSolves(sessionId, 10);
    expect(recent.map((solve) => solve.rawMs)).toEqual([3000, 2000, 1000]);
  });

  it('does not leak solves from another session', async () => {
    await addSolve(await makeSolve(sessionId, 1000));
    await addSolve(await makeSolve('other-session', 2000));

    const recent = await listRecentSolves(sessionId, 10);
    expect(recent).toHaveLength(1);
  });

  it('marks a solve as manually edited when the penalty changes', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345));
    await setPenalty(solve.id, 'plus2');

    const updated = await db.solves.get(solve.id);
    expect(updated?.penalty).toBe('plus2');
    expect(updated?.penaltySource).toBe('manual');
    expect(updated?.editedAt).not.toBeNull();
  });

  it('leaves a tombstone behind when a solve is deleted', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345));
    await deleteSolve(solve.id);

    expect(await db.solves.get(solve.id)).toBeUndefined();
    const tombstone = await db.tombstones.get(solve.id);
    expect(tombstone?.table).toBe('solves');
  });
});

describe('session repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('creates the default session once and reuses it afterwards', async () => {
    const first = await getOrCreateActiveSession('333', 'freestyle');
    const second = await getOrCreateActiveSession('333', 'freestyle');

    expect(second.id).toBe(first.id);
    expect(await db.sessions.count()).toBe(1);
  });

  it('keeps drill and freestyle sessions apart', async () => {
    await getOrCreateActiveSession('333', 'freestyle');
    await getOrCreateActiveSession('333', 'drill');

    expect(await db.sessions.count()).toBe(2);
  });
});
