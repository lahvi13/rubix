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
});
