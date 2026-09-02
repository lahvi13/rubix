import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { seedPacks } from '../seed/seed';
import {
  addUserAlgorithm,
  deleteUserAlgorithm,
  getActiveAlgorithm,
  listAlgorithms,
  listCases,
  listCasesWithAlgs,
  listSets,
  setActiveAlgorithm,
  updateUserAlgorithm,
} from './alg-repository';

describe('alg repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('lists the sets and their cases in pack order', async () => {
    const sets = await listSets();
    expect(sets.map((set) => set.id).sort()).toEqual(['f2l', 'oll', 'pll']);

    const cases = await listCases('pll');
    expect(cases).toHaveLength(21);
    expect(cases.map((entry) => entry.order)).toEqual([...cases.keys()]);
  });

  it('hands every case its active algorithm in one go', async () => {
    const cases = await listCasesWithAlgs('oll');

    expect(cases).toHaveLength(57);
    expect(cases.every((entry) => entry.active !== null)).toBe(true);
  });

  it('makes a new variant the one being drilled', async () => {
    const mine = await addUserAlgorithm('pll-t', "R U R' U' R' F R2 U' R' U' R U R' F'");

    expect((await getActiveAlgorithm('pll-t'))?.id).toBe(mine.id);
    expect(await listAlgorithms('pll-t')).toHaveLength(2);
  });

  it('keeps exactly one variant active when switching back', async () => {
    await addUserAlgorithm('pll-t', "R U R'");
    await setActiveAlgorithm('pll-t-pack');

    const algorithms = await listAlgorithms('pll-t');
    expect(algorithms.filter((algorithm) => algorithm.isActive === 1)).toHaveLength(1);
    expect((await getActiveAlgorithm('pll-t'))?.source).toBe('pack');
  });

  it('falls back to the pack algorithm when the active variant is deleted', async () => {
    const mine = await addUserAlgorithm('pll-t', "R U R'");

    await deleteUserAlgorithm(mine.id);

    expect((await getActiveAlgorithm('pll-t'))?.id).toBe('pll-t-pack');
    expect(await db.tombstones.get(mine.id)).toBeDefined();
  });

  it('refuses to delete the pack algorithm', async () => {
    await deleteUserAlgorithm('pll-t-pack');

    expect(await db.algorithms.get('pll-t-pack')).toBeDefined();
  });

  it('trims a variant when it is written or rewritten', async () => {
    const mine = await addUserAlgorithm('pll-t', "  R U R'  ");
    expect(mine.moves).toBe("R U R'");

    await updateUserAlgorithm(mine.id, "  R U' R'  ");
    expect((await db.algorithms.get(mine.id))?.moves).toBe("R U' R'");
  });
});
