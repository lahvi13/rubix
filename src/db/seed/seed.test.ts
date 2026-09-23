import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { addUserAlgorithm, setActiveAlgorithm } from '../repositories/alg-repository';
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

  it('carries over how far the reader is with a case', async () => {
    await seedPacks();
    await db.algCases.update('pll-t', { progress: 'known' });

    await seedPacks();

    expect((await db.algCases.get('pll-t'))?.progress).toBe('known');
    expect((await db.algCases.get('pll-y'))?.progress).toBe('new');
  });

  it('leaves the algorithm the user chose active', async () => {
    await seedPacks();
    const mine = await addUserAlgorithm('pll-t', "R U R' U'");

    await seedPacks();

    expect((await db.algorithms.get(mine.id))?.isActive).toBe(1);
    expect((await db.algorithms.get('pll-t-pack'))?.isActive).toBe(0);
  });

  it('leaves a second built-in algorithm active when it is the one chosen', async () => {
    await seedPacks();
    const other = 'pll-ua-pack-other-1';
    await setActiveAlgorithm(other);

    await seedPacks();

    // Picking another of the built-in ones is as much a choice as typing one
    // in. The seed used to count only the typed ones and switch its own answer
    // back on, which left two rows active at once — the screen then showed one
    // of them and ticked the other.
    expect((await db.algorithms.get(other))?.isActive).toBe(1);
    expect((await db.algorithms.get('pll-ua-pack'))?.isActive).toBe(0);
  });

  it('puts a case with two active rows back to one', async () => {
    await seedPacks();
    const other = 'pll-ua-pack-other-1';
    // What the old seed left behind, on a database that has been through it.
    await db.algorithms.update(other, { isActive: 1 });
    await db.algorithms.update('pll-ua-pack', { isActive: 1 });

    await seedPacks();

    const rows = await db.algorithms.where('caseId').equals('pll-ua').toArray();
    expect(rows.filter((row) => row.isActive === 1).map((row) => row.id)).toEqual([other]);
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

describe('retiring a case the packs have dropped', () => {
  /** A leftover from an older pack version, as a device would still hold it. */
  async function leaveBehind(id = 'beg-edge-right'): Promise<void> {
    await db.algCases.put({
      id,
      setId: 'beginner',
      name: 'Edge to the right',
      label: null,
      progress: 'new',
      group: 'Middle layer edges',
      setupAlg: "F' U' F U R U R' U'",
      order: 99,
      isCustom: 0,
      packVersion: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    await db.algorithms.put({
      id: `${id}-pack`,
      caseId: id,
      moves: "U R U' R' U' F' U F",
      isActive: 1,
      source: 'pack',
      packVersion: 1,
      createdAt: 1,
      updatedAt: 1,
    });
  }

  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('takes it out along with its pack algorithm', async () => {
    await leaveBehind();
    await seedPacks();

    expect(await db.algCases.get('beg-edge-right')).toBeUndefined();
    expect(await db.algorithms.get('beg-edge-right-pack')).toBeUndefined();
  });

  it('leaves a tombstone, so an import cannot bring it back', async () => {
    await leaveBehind();
    await seedPacks();

    expect(await db.tombstones.get('beg-edge-right')).toMatchObject({ table: 'algCases' });
    expect(await db.tombstones.get('beg-edge-right-pack')).toMatchObject({
      table: 'algorithms',
    });
  });

  it('keeps a case the reader made their own', async () => {
    await leaveBehind();
    await db.algCases.update('beg-edge-right', { isCustom: 1 });
    await seedPacks();

    expect(await db.algCases.get('beg-edge-right')).toBeDefined();
  });

  it('keeps a case the reader renamed', async () => {
    await leaveBehind();
    await db.algCases.update('beg-edge-right', { label: 'Moje hrana' });
    await seedPacks();

    expect(await db.algCases.get('beg-edge-right')).toBeDefined();
  });

  it.each(['learning', 'known'] as const)('keeps a case the reader marked %s', async (progress) => {
    await leaveBehind();
    await db.algCases.update('beg-edge-right', { progress });
    await seedPacks();

    expect(await db.algCases.get('beg-edge-right')).toBeDefined();
  });

  it('keeps a case the reader wrote an algorithm for', async () => {
    await leaveBehind();
    await addUserAlgorithm('beg-edge-right', "R U R' U'");
    await seedPacks();

    expect(await db.algCases.get('beg-edge-right')).toBeDefined();
    expect(await db.algorithms.get('beg-edge-right-pack')).toBeDefined();
  });

  it('keeps a case something timed still points at', async () => {
    await leaveBehind();
    await db.solves.put({
      id: 'attempt-1',
      sessionId: 'drill-session',
      puzzle: '333',
      mode: 'drill',
      caseId: 'beg-edge-right',
      scramble: '',
      scrambleSource: 'generated',
      rawMs: 4200,
      penalty: 'none',
      penaltySource: 'manual',
      inspectionMs: null,
      startedAt: 1,
      splits: [],
      splitsSchemaVersion: 1,
      tagIds: [],
      note: null,
      starred: 0,
      editedAt: null,
      createdAt: 1,
      updatedAt: 1,
    });
    await seedPacks();

    expect(await db.algCases.get('beg-edge-right')).toBeDefined();
  });

  it('leaves the packs their own cases', async () => {
    await leaveBehind();
    await seedPacks();

    expect(await db.algCases.count()).toBe(totalCases + 1);
    expect(await db.algorithms.count()).toBe(totalAlgorithms);
  });

  it('is idempotent', async () => {
    await leaveBehind();
    await seedPacks();
    const first = await snapshot();

    await seedPacks();
    expect(await snapshot()).toBe(first);
    expect(await db.tombstones.count()).toBe(2);
  });
});
