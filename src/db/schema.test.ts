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

  it("moves another cube's sessions out of CFOP when v9 lets the app switch cubes", async () => {
    const name = 'rubix-upgrade-v9';
    const v8 = new Dexie(name);
    v8.version(8).stores({
      sessions: 'id, puzzle, mode, updatedAt, [puzzle+mode+isActive], [mode+isArchived]',
    });
    await v8.table('sessions').bulkAdd([
      { id: 'cube', puzzle: '333', mode: 'freestyle', methodId: 'cfop', updatedAt: 1 },
      { id: 'blocks', puzzle: '333', mode: 'freestyle', methodId: 'roux', updatedAt: 1 },
      { id: 'pocket', puzzle: '222', mode: 'freestyle', methodId: 'cfop', updatedAt: 1 },
      { id: 'pyramid', puzzle: 'pyram', mode: 'freestyle', methodId: 'cfop', updatedAt: 1 },
    ]);
    v8.close();

    const upgraded = new RubixDB(name);
    const sessions = await upgraded.sessions.toArray();
    expect(Object.fromEntries(sessions.map((session) => [session.id, session.methodId]))).toEqual({
      cube: 'cfop',
      blocks: 'roux',
      pocket: '222',
      pyramid: 'pyram',
    });
    // Only the rows that changed count as changed.
    expect(sessions.find((session) => session.id === 'cube')?.updatedAt).toBe(1);
    expect(sessions.find((session) => session.id === 'pocket')?.updatedAt).toBeGreaterThan(1);
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
