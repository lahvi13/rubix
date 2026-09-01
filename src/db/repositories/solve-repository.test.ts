import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { getOrCreateActiveSession } from './session-repository';
import {
  addSolve,
  deleteSolve,
  deleteSolves,
  listRecentSolves,
  listSolves,
  setPenalty,
  updateSolve,
} from './solve-repository';
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

describe('solve filtering', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    const session = await getOrCreateActiveSession('333', 'freestyle');
    sessionId = session.id;
  });

  it('filters by penalty', async () => {
    const clean = await addSolve(await makeSolve(sessionId, 1000));
    const penalised = await addSolve(await makeSolve(sessionId, 2000));
    await updateSolve(penalised.id, { penalty: 'dnf' });

    const dnfs = await listSolves(sessionId, 50, { penalty: 'dnf' });
    expect(dnfs.map((solve) => solve.id)).toEqual([penalised.id]);

    const none = await listSolves(sessionId, 50, { penalty: 'none' });
    expect(none.map((solve) => solve.id)).toEqual([clean.id]);
  });

  it('filters by star and by tag', async () => {
    const starred = await addSolve(await makeSolve(sessionId, 1000));
    const tagged = await addSolve(await makeSolve(sessionId, 2000));
    await updateSolve(starred.id, { starred: 1 });
    await updateSolve(tagged.id, { tagIds: ['tag-a'] });

    expect(await listSolves(sessionId, 50, { starred: true })).toHaveLength(1);
    expect(await listSolves(sessionId, 50, { tagId: 'tag-a' })).toHaveLength(1);
    expect(await listSolves(sessionId, 50, { tagId: 'tag-b' })).toHaveLength(0);
  });

  it('respects the limit while keeping newest first', async () => {
    for (const ms of [1000, 2000, 3000, 4000]) {
      await addSolve(await makeSolve(sessionId, ms));
    }

    const page = await listSolves(sessionId, 2);
    expect(page.map((solve) => solve.rawMs)).toEqual([4000, 3000]);
  });
});

describe('solve editing', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    const session = await getOrCreateActiveSession('333', 'freestyle');
    sessionId = session.id;
  });

  it('records the correction of a mistimed solve', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345));
    await updateSolve(solve.id, { rawMs: 13_000 });

    const stored = await db.solves.get(solve.id);
    expect(stored?.rawMs).toBe(13_000);
    expect(stored?.editedAt).not.toBeNull();
  });

  it('never rewrites the scramble or the identity of a solve', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345));
    await updateSolve(solve.id, { note: 'bad F2L' });

    const stored = await db.solves.get(solve.id);
    expect(stored?.scramble).toBe(solve.scramble);
    expect(stored?.createdAt).toBe(solve.createdAt);
    expect(stored?.startedAt).toBe(solve.startedAt);
  });

  it('deletes many solves in one go, each with a tombstone', async () => {
    const first = await addSolve(await makeSolve(sessionId, 1000));
    const second = await addSolve(await makeSolve(sessionId, 2000));

    await deleteSolves([first.id, second.id]);

    expect(await db.solves.count()).toBe(0);
    expect(await db.tombstones.count()).toBe(2);
  });

  it('does nothing when the delete list is empty', async () => {
    await addSolve(await makeSolve(sessionId, 1000));
    await deleteSolves([]);

    expect(await db.solves.count()).toBe(1);
    expect(await db.tombstones.count()).toBe(0);
  });
});
