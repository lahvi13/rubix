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
  markCaseLearning,
  setActiveAlgorithm,
  setCaseProgress,
  updateUserAlgorithm,
} from './alg-repository';
import { PACKS } from '../seed/packs';

/** How many algorithms a case ships with, counted from the pack itself. */
function packAlgorithms(caseId: string): number {
  for (const pack of PACKS) {
    const entry = pack.cases.find((candidate) => candidate.id === caseId);
    if (entry === undefined) continue;
    return (
      1 +
      (entry.alt === undefined ? 0 : 1) +
      (entry.others?.length ?? 0) +
      (entry.multiSlot?.length ?? 0)
    );
  }
  throw new Error(`no such case: ${caseId}`);
}

describe('alg repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('lists the sets and their cases in pack order', async () => {
    const sets = await listSets();
    expect(sets.map((set) => set.id).sort()).toEqual([
      // Roux's corners, in two looks and in one, and its edge orientation: the
      // sets that are not CFOP's.
      '2look-cmll',
      '2look-oll',
      '2look-pll',
      // The first two layers as the beginner's guide builds them.
      'beginner',
      'cmll',
      // A set to drill rather than to read, but a set all the same.
      'cross',
      'f2l',
      'f2l-advanced',
      'f2l-expert',
      'oll',
      'pll',
      'roux-eo',
    ]);

    const cases = await listCases('pll');
    expect(cases).toHaveLength(21);
    expect(cases.map((entry) => entry.order)).toEqual([...cases.keys()]);
  });

  it('offers the sets in solving order, not alphabetical order', async () => {
    expect((await listSets()).map((set) => set.id)).toEqual([
      'cross',
      'beginner',
      'f2l',
      'f2l-advanced',
      'f2l-expert',
      '2look-oll',
      'oll',
      '2look-pll',
      'pll',
      '2look-cmll',
      'cmll',
      'roux-eo',
    ]);
  });

  it('hands every case its active algorithm in one go', async () => {
    const cases = await listCasesWithAlgs('oll');

    expect(cases).toHaveLength(57);
    expect(cases.every((entry) => entry.active !== null)).toBe(true);
  });

  it('makes a new variant the one being drilled', async () => {
    const mine = await addUserAlgorithm('pll-t', "R U R' U' R' F R2 U' R' U' R U R' F'");

    expect((await getActiveAlgorithm('pll-t'))?.id).toBe(mine.id);
    // One more than the case shipped with, however many that is: the packs
    // gain algorithms and the point here is that nothing was replaced.
    expect(await listAlgorithms('pll-t')).toHaveLength(packAlgorithms('pll-t') + 1);
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

  it('refuses to rewrite the pack algorithm', async () => {
    const before = await db.algorithms.get('pll-t-pack');

    await updateUserAlgorithm('pll-t-pack', "R U R'");

    expect(await db.algorithms.get('pll-t-pack')).toEqual(before);
  });

  it('reads a variant typed without spaces', async () => {
    const mine = await addUserAlgorithm('pll-t', "(RUR'U')(RU2R')");

    expect(mine.moves).toBe("(R U R' U') (R U2 R')");
  });

  it('trims a variant when it is written or rewritten', async () => {
    const mine = await addUserAlgorithm('pll-t', "  R U R'  ");
    expect(mine.moves).toBe("R U R'");

    await updateUserAlgorithm(mine.id, "  R U' R'  ");
    expect((await db.algorithms.get(mine.id))?.moves).toBe("R U' R'");
  });

  it('stores a variant the way the app writes it, whatever spelling came in', async () => {
    const mine = await addUserAlgorithm('oll-2', "F R U R' U' F' Fw R U R' U' Fw'");
    expect(mine.moves).toBe("F R U R' U' F' f R U R' U' f'");

    // The spelling is the app's; the brackets are the writer's. Where somebody
    // put them is how they hold the algorithm, and tidying them away would be
    // throwing out the half of it that is theirs.
    await updateUserAlgorithm(mine.id, "(Rw U R') U'");
    expect((await db.algorithms.get(mine.id))?.moves).toBe("(r U R') U'");
  });

  it('keeps text it cannot read as typed, so nothing is silently lost', async () => {
    const mine = await addUserAlgorithm('pll-t', '  R U nonsense  ');

    expect(mine.moves).toBe('R U nonsense');
  });
});

describe('how far the reader is with a case', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await seedPacks();
  });

  it('starts every case as new', async () => {
    const cases = await db.algCases.toArray();
    expect(cases.every((algCase) => algCase.progress === 'new')).toBe(true);
  });

  it.each(['learning', 'known', 'new'] as const)('takes %s from the reader', async (progress) => {
    await setCaseProgress('pll-t', progress);
    expect((await db.algCases.get('pll-t'))?.progress).toBe(progress);
  });

  it.each<['new' | 'learning' | 'known', 'new' | 'learning' | 'known']>([
    ['new', 'learning'],
    ['learning', 'learning'],
    // Drilled to keep it sharp, not because it was forgotten.
    ['known', 'known'],
  ])('moves a case on from %s to %s when it is drilled', async (before, after) => {
    await setCaseProgress('pll-t', before);
    const stamped = (await db.algCases.get('pll-t'))?.updatedAt;

    await markCaseLearning('pll-t');

    const algCase = await db.algCases.get('pll-t');
    expect(algCase?.progress).toBe(after);
    // A case left as it was is not written, so an import does not see a change.
    if (before === after) expect(algCase?.updatedAt).toBe(stamped);
  });
  it.each([
    ['2pll-t', 'pll-t'],
    ['oll-27', '2oll-sune'],
  ])('marks %s and its twin %s together', async (marked, twin) => {
    await setCaseProgress(marked, 'known');
    expect((await db.algCases.get(twin))?.progress).toBe('known');

    await setCaseProgress(twin, 'learning');
    expect((await db.algCases.get(marked))?.progress).toBe('learning');
  });

  it('leaves a two-look edge case apart from the OLL that shares its algorithm', async () => {
    await setCaseProgress('2oll-line', 'known');
    expect((await db.algCases.get('oll-45'))?.progress).toBe('new');
  });

  it('moves a twin on too when its pair is drilled', async () => {
    await markCaseLearning('2pll-ua');
    expect((await db.algCases.get('pll-ua'))?.progress).toBe('learning');
  });

  it('shares only the progress, not the algorithms', async () => {
    const mine = await addUserAlgorithm('2pll-t', "R U R' U' R' F R2 U' R' U' R U R' F'");
    await setActiveAlgorithm(mine.id);
    await setCaseProgress('2pll-t', 'known');

    expect((await listAlgorithms('pll-t')).some((row) => row.source === 'user')).toBe(false);
    expect((await getActiveAlgorithm('2pll-t'))?.id).toBe(mine.id);
    expect((await getActiveAlgorithm('pll-t'))?.id).toBe('pll-t-pack');
  });
});
