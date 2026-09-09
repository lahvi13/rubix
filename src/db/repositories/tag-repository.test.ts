import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { getOrCreateActiveSession } from './session-repository';
import { addSolve, updateSolve } from './solve-repository';
import { createTag, deleteTag, listTags, renameTag, restoreTag } from './tag-repository';

async function solveIn(sessionId: string) {
  return addSolve({
    sessionId,
    puzzle: '333',
    mode: 'freestyle',
    scramble: "R U R'",
    rawMs: 12_000,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
  });
}

describe('tag repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('assigns colours from the palette in order', async () => {
    const first = await createTag('ao5 practice');
    const second = await createTag('one-handed');

    expect(first.color).not.toBe(second.color);
  });

  it('trims the name', async () => {
    const tag = await createTag('  lookahead  ');
    expect(tag.name).toBe('lookahead');
  });

  it('sorts tags by name', async () => {
    await createTag('zebra');
    await createTag('alpha');

    expect((await listTags()).map((tag) => tag.name)).toEqual(['alpha', 'zebra']);
  });

  it('strips a deleted tag from every solve that used it', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    const tag = await createTag('slow cross');
    const other = await createTag('keep me');

    const first = await solveIn(session.id);
    const second = await solveIn(session.id);
    await updateSolve(first.id, { tagIds: [tag.id, other.id] });
    await updateSolve(second.id, { tagIds: [tag.id] });

    await deleteTag(tag.id);

    expect((await db.solves.get(first.id))?.tagIds).toEqual([other.id]);
    expect((await db.solves.get(second.id))?.tagIds).toEqual([]);
  });

  it('leaves a tombstone for a deleted tag', async () => {
    const tag = await createTag('temporary');
    await deleteTag(tag.id);

    expect(await db.tags.get(tag.id)).toBeUndefined();
    expect((await db.tombstones.get(tag.id))?.table).toBe('tags');
  });

  it('renames a tag in place, so solves keep pointing at it', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    const tag = await createTag('typo');
    const solve = await solveIn(session.id);
    await updateSolve(solve.id, { tagIds: [tag.id] });

    await renameTag(tag.id, 'fixed');

    expect((await db.tags.get(tag.id))?.name).toBe('fixed');
    expect((await db.solves.get(solve.id))?.tagIds).toEqual([tag.id]);
  });
  it('puts a deleted tag back on the solves it came off', async () => {
    const tag = await createTag('warmup');
    const session = await getOrCreateActiveSession('333', 'freestyle');
    const solve = await solveIn(session.id);
    await updateSolve(solve.id, { tagIds: [tag.id] });

    const deleted = await deleteTag(tag.id);
    expect((await db.solves.get(solve.id))?.tagIds).toEqual([]);

    await restoreTag(deleted!);

    expect((await listTags()).map((row) => row.name)).toEqual(['warmup']);
    expect((await db.solves.get(solve.id))?.tagIds).toEqual([tag.id]);
    expect(await db.tombstones.get(tag.id)).toBeUndefined();
  });

  it('reports nothing for a tag that is not there', async () => {
    expect(await deleteTag('missing')).toBeNull();
  });
});
