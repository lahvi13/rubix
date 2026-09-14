import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import {
  createSession,
  getOrCreateActiveSession,
  setSessionArchived,
} from './session-repository';
import {
  addSolve,
  deleteSolve,
  deleteSolves,
  getGlobalPbSingle,
  getGlobalPbSolve,
  listRecentSolves,
  listSolves,
  listPuzzleSolvesChronological,
  listSolvesChronological,
  moveSolves,
  restoreSolves,
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

describe('stats queries', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    const session = await getOrCreateActiveSession('333', 'freestyle');
    sessionId = session.id;
  });

  it('lists the session chronologically, oldest first', async () => {
    await addSolve(await makeSolve(sessionId, 3000));
    await addSolve(await makeSolve(sessionId, 1000));
    await addSolve(await makeSolve(sessionId, 2000));

    const solves = await listSolvesChronological(sessionId);
    expect(solves.map((solve) => solve.rawMs)).toEqual([3000, 1000, 2000]);
  });

  it('lists every freestyle solve of a puzzle across sessions, oldest first', async () => {
    await addSolve(await makeSolve(sessionId, 3000));
    await addSolve(await makeSolve('other-session', 1000));
    await addSolve({ ...(await makeSolve(sessionId, 4000)), mode: 'drill' });
    await addSolve({ ...(await makeSolve(sessionId, 5000)), puzzle: '222' });
    await addSolve(await makeSolve(sessionId, 2000));

    const solves = await listPuzzleSolvesChronological('333');
    expect(solves.map((solve) => solve.rawMs)).toEqual([3000, 1000, 2000]);
  });

  it('leaves archived sessions out of the solves across sessions, but not out of the PB', async () => {
    const archived = await createSession('Old', '333', 'freestyle');
    await addSolve(await makeSolve(archived.id, 5000));
    await setSessionArchived(archived.id, true);
    await addSolve(await makeSolve(sessionId, 12_000));

    const solves = await listPuzzleSolvesChronological('333');
    expect(solves.map((solve) => solve.rawMs)).toEqual([12_000]);
    expect(await getGlobalPbSingle('333')).toBe(5000);
  });

  it('finds the global PB across sessions and applies the +2', async () => {
    await addSolve(await makeSolve(sessionId, 10_000));
    const other = await addSolve(await makeSolve('other-session', 9000));
    await updateSolve(other.id, { penalty: 'plus2' });

    // 9000 raw would win, but with the +2 it is 11000 — the clean 10s stays.
    expect(await getGlobalPbSingle('333')).toBe(10_000);

    await addSolve(await makeSolve('other-session', 7000));
    expect(await getGlobalPbSingle('333')).toBe(7000);
  });

  it('gives a tie for the PB to the clean solve over the +2', async () => {
    const clean = await addSolve(await makeSolve(sessionId, 10_000));
    const penalised = await addSolve(await makeSolve(sessionId, 8000));
    await updateSolve(penalised.id, { penalty: 'plus2' });

    expect((await getGlobalPbSolve('333'))?.id).toBe(clean.id);
  });

  it('ignores DNFs, drills and other puzzles for the global PB', async () => {
    const dnf = await addSolve(await makeSolve(sessionId, 1000));
    await updateSolve(dnf.id, { penalty: 'dnf' });
    await addSolve({ ...(await makeSolve(sessionId, 2000)), mode: 'drill' });
    await addSolve({ ...(await makeSolve(sessionId, 3000)), puzzle: '222' });
    await addSolve(await makeSolve(sessionId, 8000));

    expect(await getGlobalPbSingle('333')).toBe(8000);
  });

  it('has no global PB when nothing counts', async () => {
    const dnf = await addSolve(await makeSolve(sessionId, 1000));
    await updateSolve(dnf.id, { penalty: 'dnf' });

    expect(await getGlobalPbSingle('333')).toBeNull();
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

  it('hands back the rows it deleted, so they can be put back', async () => {
    const first = await addSolve(await makeSolve(sessionId, 1000));
    const second = await addSolve(await makeSolve(sessionId, 2000));

    const removed = await deleteSolves([first.id, second.id, 'never-existed']);

    expect(removed.map((solve) => solve.rawMs)).toEqual([1000, 2000]);
  });

  it('restores a deleted solve exactly as it was, tombstone and all', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345));
    await updateSolve(solve.id, { note: 'bad F2L' });
    const before = await db.solves.get(solve.id);

    const removed = await deleteSolves([solve.id]);
    await restoreSolves(removed);

    expect(await db.solves.get(solve.id)).toEqual(before);
    // The grave has to go too, or the next import deletes the row again.
    expect(await db.tombstones.count()).toBe(0);
  });

  it('leaves another table’s tombstone alone when it restores a solve', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_345));
    const removed = await deleteSolves([solve.id]);
    // Pack ids are hand-written, so a collision with a solve id is possible.
    await db.tombstones.put({ id: 'pll-t', table: 'algCases', deletedAt: 1 });

    await restoreSolves(removed);

    expect(await db.tombstones.toArray()).toEqual([
      { id: 'pll-t', table: 'algCases', deletedAt: 1 },
    ]);
  });
});

describe('solve repository splits', () => {
  const PHASES = ['cross', 'f2l', 'oll', 'pll'];
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    const session = await getOrCreateActiveSession('333', 'freestyle');
    sessionId = session.id;
  });

  it('stores the phase boundaries of a guided solve, in method order', async () => {
    const solve = await addSolve({
      ...(await makeSolve(sessionId, 20_000)),
      splits: [
        { phase: 'oll', atMs: 14_000, source: 'manual' },
        { phase: 'cross', atMs: 2000, source: 'manual' },
      ],
      phaseKeys: PHASES,
    });

    expect(solve.splits.map((split) => split.phase)).toEqual(['cross', 'oll']);
    expect((await db.solves.get(solve.id))?.splits).toEqual(solve.splits);
  });

  it('drops a boundary that does not fit inside the solve', async () => {
    const solve = await addSolve({
      ...(await makeSolve(sessionId, 20_000)),
      splits: [{ phase: 'cross', atMs: 25_000, source: 'manual' }],
      phaseKeys: PHASES,
    });

    expect(solve.splits).toEqual([]);
  });

  it('replaces the whole set when the user edits them, and marks the solve edited', async () => {
    const solve = await addSolve({
      ...(await makeSolve(sessionId, 20_000)),
      splits: [{ phase: 'cross', atMs: 2000, source: 'manual' }],
      phaseKeys: PHASES,
    });

    await updateSolve(solve.id, {
      splits: [{ phase: 'cross', atMs: 3000, source: 'manual' }],
      phaseKeys: PHASES,
    });

    const stored = await db.solves.get(solve.id);
    expect(stored?.splits).toEqual([{ phase: 'cross', atMs: 3000, source: 'manual' }]);
    expect(stored?.editedAt).not.toBeNull();
  });

  it('drops the boundaries a corrected raw time no longer contains', async () => {
    const solve = await addSolve({
      ...(await makeSolve(sessionId, 20_000)),
      splits: [
        { phase: 'cross', atMs: 2000, source: 'manual' },
        { phase: 'f2l', atMs: 10_000, source: 'manual' },
      ],
      phaseKeys: PHASES,
    });

    await updateSolve(solve.id, { rawMs: 5000 });

    expect((await db.solves.get(solve.id))?.splits).toEqual([
      { phase: 'cross', atMs: 2000, source: 'manual' },
    ]);
  });

  it('leaves the boundaries alone when an unrelated field changes', async () => {
    const solve = await addSolve({
      ...(await makeSolve(sessionId, 20_000)),
      splits: [{ phase: 'cross', atMs: 2000, source: 'manual' }],
      phaseKeys: PHASES,
    });

    await updateSolve(solve.id, { penalty: 'plus2' });

    expect((await db.solves.get(solve.id))?.splits).toHaveLength(1);
  });
});
describe('moving solves between sessions', () => {
  let sessionId: string;

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    sessionId = (await getOrCreateActiveSession('333', 'freestyle')).id;
  });

  it('files the solves under the destination and reports them as they were', async () => {
    const other = await createSession('Evening', '333', 'freestyle');
    const first = await addSolve(await makeSolve(sessionId, 12_340));
    const second = await addSolve(await makeSolve(sessionId, 9990));

    const previous = await moveSolves([first.id, second.id], other.id);

    expect(previous.map((solve) => solve.sessionId)).toEqual([sessionId, sessionId]);
    expect(await listSolvesChronological(other.id)).toHaveLength(2);
    expect(await listSolvesChronological(sessionId)).toHaveLength(0);
  });

  it('is taken back by putting the reported rows back', async () => {
    const other = await createSession('Evening', '333', 'freestyle');
    const solve = await addSolve(await makeSolve(sessionId, 12_340));

    const previous = await moveSolves([solve.id], other.id);
    await restoreSolves(previous);

    expect(await listSolvesChronological(sessionId)).toHaveLength(1);
    expect(await listSolvesChronological(other.id)).toHaveLength(0);
  });

  // Otherwise the undo bar offers to put a solve back where it already is.
  it('reports nothing for a solve already in the destination', async () => {
    const solve = await addSolve(await makeSolve(sessionId, 12_340));

    expect(await moveSolves([solve.id], sessionId)).toEqual([]);
  });

  // A move is not an adjustment of the solve; the detail must not claim one.
  it('leaves editedAt alone', async () => {
    const other = await createSession('Evening', '333', 'freestyle');
    const solve = await addSolve(await makeSolve(sessionId, 12_340));

    await moveSolves([solve.id], other.id);

    expect((await db.solves.get(solve.id))?.editedAt).toBeNull();
  });
});
