import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { addUserAlgorithm } from '../repositories/alg-repository';
import { deleteTrigger, updateTrigger } from '../repositories/trigger-repository';
import { CROSS_CASE_ID, CROSS_SET_ID, PACKS } from './packs';
import { seedPacks } from './seed';

const totalCases = PACKS.reduce((count, pack) => count + pack.cases.length, 0);

/** A case ships its own algorithm, plus every extra offered beside it. */
const totalAlgorithms = PACKS.reduce(
  (count, pack) =>
    count +
    pack.cases.reduce(
      (own, entry) =>
        own +
        1 +
        (entry.alt === undefined ? 0 : 1) +
        (entry.others?.length ?? 0) +
        (entry.multiSlot?.length ?? 0) +
        (entry.orientOnly?.length ?? 0),
      0,
    ),
  0,
);

/** What the tables look like, ignoring when rows were written. */
async function snapshot(): Promise<string> {
  const tables = await Promise.all(
    [db.methods, db.algSets, db.algCases, db.algorithms, db.triggers].map((table) =>
      table.toArray(),
    ),
  );
  return JSON.stringify(
    tables.map((rows) =>
      rows.map((row) =>
        Object.entries(row)
          .filter(([key]) => key !== 'createdAt' && key !== 'updatedAt')
          .sort(([left], [right]) => (left < right ? -1 : 1)),
      ),
    ),
  );
}

describe('seed', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('puts every pack case in place with an algorithm to drill', async () => {
    await seedPacks();

    // The cross is a set and a case of its own, on top of the packs.
    expect(await db.algSets.count()).toBe(PACKS.length + 1);
    expect(await db.algCases.count()).toBe(totalCases + 1);
    expect(await db.algorithms.count()).toBe(totalAlgorithms);
    expect(await db.methods.get('cfop')).toBeDefined();
  });

  it('gives every case a setup that undoes its algorithm', async () => {
    await seedPacks();

    // Except the cross, which is met through a real scramble, not a setup.
    const cases = (await db.algCases.toArray()).filter((entry) => entry.id !== CROSS_CASE_ID);
    expect(cases.every((entry) => entry.setupAlg.length > 0)).toBe(true);
  });

  it('seeds the cross as a set to drill, with nothing to look up', async () => {
    await seedPacks();

    expect((await db.algSets.get(CROSS_SET_ID))?.name).toBe('Cross');
    expect((await db.algCases.get(CROSS_CASE_ID))?.setId).toBe(CROSS_SET_ID);
    expect(await db.algorithms.where('caseId').equals(CROSS_CASE_ID).count()).toBe(0);
  });

  it('runs twice with the same result', async () => {
    await seedPacks();
    const first = await snapshot();
    const timestamps = (await db.algCases.toArray()).map((entry) => entry.updatedAt);

    await seedPacks();

    expect(await snapshot()).toBe(first);
    // Nothing changed, so nothing may look freshly written either.
    expect((await db.algCases.toArray()).map((entry) => entry.updatedAt)).toEqual(timestamps);
  });

  it('leaves the algorithm the user chose active', async () => {
    await seedPacks();
    const mine = await addUserAlgorithm('pll-t', "R U R' U'");

    await seedPacks();

    expect((await db.algorithms.get(mine.id))?.isActive).toBe(1);
    expect((await db.algorithms.get('pll-t-pack'))?.isActive).toBe(0);
  });

  it('keeps a custom case out of the pack', async () => {
    await seedPacks();
    await db.algCases.update('oll-1', { isCustom: 1, name: 'My own OLL 1' });

    await seedPacks();

    expect((await db.algCases.get('oll-1'))?.name).toBe('My own OLL 1');
  });

  it('does not overwrite a built-in trigger the user rewrote', async () => {
    await seedPacks();
    await updateTrigger('trigger-sexy', { name: 'Right hand thing', moves: "R U R' U'" });

    await seedPacks();

    const trigger = await db.triggers.get('trigger-sexy');
    expect(trigger?.name).toBe('Right hand thing');
    expect(trigger?.source).toBe('user');
  });

  it('does not bring back a trigger the user deleted', async () => {
    await seedPacks();
    await deleteTrigger('trigger-sledgehammer');

    await seedPacks();

    expect(await db.triggers.get('trigger-sledgehammer')).toBeUndefined();
  });
});
