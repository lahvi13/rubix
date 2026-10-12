import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { RubixDB } from './schema';

describe('schema upgrades', () => {
  it('orders the solves already stored by time when v4 adds the index', async () => {
    const name = 'rubix-upgrade-v4';
    // The solves table as v3 left it, with rows in it.
    const v3 = new Dexie(name);
    v3.version(3).stores({
      solves:
        'id, sessionId, caseId, createdAt, updatedAt, starred, *tagIds, ' +
        '[sessionId+createdAt], [caseId+createdAt], [mode+puzzle], [puzzle+mode+penalty]',
    });
    await v3.table('solves').bulkAdd([
      { id: 'slow', puzzle: '333', mode: 'freestyle', penalty: 'none', rawMs: 30_000, tagIds: [] },
      { id: 'fast', puzzle: '333', mode: 'freestyle', penalty: 'none', rawMs: 12_000, tagIds: [] },
    ]);
    v3.close();

    const upgraded = new RubixDB(name);
    const first = await upgraded.solves
      .where('[puzzle+mode+penalty+rawMs]')
      .between(['333', 'freestyle', 'none', Dexie.minKey], ['333', 'freestyle', 'none', Dexie.maxKey])
      .first();
    expect(first?.id).toBe('fast');
    upgraded.close();
    await Dexie.delete(name);
  });

  it('orders each session by time when v8 adds the index the best of a method is read from', async () => {
    const name = 'rubix-upgrade-v8';
    // The solves table as v7 left it, with rows in it.
    const v7 = new Dexie(name);
    v7.version(7).stores({
      solves:
        'id, sessionId, caseId, createdAt, updatedAt, starred, *tagIds, ' +
        '[sessionId+createdAt], [caseId+createdAt], [mode+puzzle], [puzzle+mode+penalty], ' +
        '[puzzle+mode+penalty+rawMs], [mode+updatedAt]',
    });
    await v7.table('solves').bulkAdd([
      { id: 'slow', sessionId: 'blocks', penalty: 'none', rawMs: 64_000, tagIds: [] },
      { id: 'fast', sessionId: 'blocks', penalty: 'none', rawMs: 58_000, tagIds: [] },
      { id: 'other', sessionId: 'morning', penalty: 'none', rawMs: 15_000, tagIds: [] },
    ]);
    v7.close();

    const upgraded = new RubixDB(name);
    const first = await upgraded.solves
      .where('[sessionId+penalty+rawMs]')
      .between(['blocks', 'none', Dexie.minKey], ['blocks', 'none', Dexie.maxKey])
      .first();
    expect(first?.id).toBe('fast');
    upgraded.close();
    await Dexie.delete(name);
  });

  it('says every solve stored before v5 was on a scramble the app drew', async () => {
    const name = 'rubix-upgrade-v5';
    const v4 = new Dexie(name);
    v4.version(4).stores({
      solves:
        'id, sessionId, caseId, createdAt, updatedAt, starred, *tagIds, ' +
        '[sessionId+createdAt], [caseId+createdAt], [mode+puzzle], [puzzle+mode+penalty], ' +
        '[puzzle+mode+penalty+rawMs]',
    });
    await v4.table('solves').add({ id: 'old', puzzle: '333', mode: 'freestyle', tagIds: [] });
    v4.close();

    const upgraded = new RubixDB(name);
    expect((await upgraded.solves.get('old'))?.scrambleSource).toBe('generated');
    upgraded.close();
    await Dexie.delete(name);
  });

  it('starts every case stored before v6 as new', async () => {
    const name = 'rubix-upgrade-v6';
    const v5 = new Dexie(name);
    v5.version(5).stores({ algCases: 'id, setId, isCustom, updatedAt, [setId+order]' });
    await v5.table('algCases').add({ id: 'pll-t', setId: 'pll', order: 0 });
    v5.close();

    const upgraded = new RubixDB(name);
    expect((await upgraded.algCases.get('pll-t'))?.progress).toBe('new');
    upgraded.close();
    await Dexie.delete(name);
  });
});
