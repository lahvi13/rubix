import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { seedPacks } from '../seed/seed';
import {
  addDrillSolve,
  deleteCaseAttempts,
  detachCase,
  listAttemptsByCase,
  listCaseAttempts,
  loadDrillPool,
  type NewDrillSolve,
} from './drill-repository';
import { getActiveSession, getOrCreateActiveSession } from './session-repository';
import {
  addSolve,
  getGlobalPbSingle,
  listSolvesChronological,
} from './solve-repository';

function makeAttempt(caseId: string, rawMs: number): NewDrillSolve {
  return {
    puzzle: '333',
    caseId,
    scramble: "y R U R' U'",
    rawMs,
    penalty: 'none',
    penaltySource: 'auto',
    inspectionMs: null,
    startedAt: Date.now(),
  };
}

describe('drill repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('counts a case drilled for the first time as being learned', async () => {
    await seedPacks();
    await addDrillSolve(makeAttempt('pll-t', 2500));

    expect((await db.algCases.get('pll-t'))?.progress).toBe('learning');
    expect((await db.algCases.get('pll-y'))?.progress).toBe('new');
  });

  it('stores an attempt as a drill against its case', async () => {
    const solve = await addDrillSolve(makeAttempt('pll-t', 2500));

    expect(solve.mode).toBe('drill');
    expect(solve.caseId).toBe('pll-t');
    expect(solve.rawMs).toBe(2500);
  });

  it('drills into their own session, not the one being timed', async () => {
    const freestyle = await getOrCreateActiveSession('333', 'freestyle');
    const solve = await addDrillSolve(makeAttempt('pll-t', 2500));

    expect(solve.sessionId).not.toBe(freestyle.id);
    expect((await getActiveSession('333', 'drill'))?.id).toBe(solve.sessionId);
    // The freestyle session stays active alongside it.
    expect((await getActiveSession('333', 'freestyle'))?.id).toBe(freestyle.id);
  });

  it('keeps drills out of the history and the personal best', async () => {
    const freestyle = await getOrCreateActiveSession('333', 'freestyle');
    await addSolve({
      sessionId: freestyle.id,
      puzzle: '333',
      mode: 'freestyle',
      scramble: "R U R'",
      rawMs: 20_000,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });
    await addDrillSolve(makeAttempt('pll-t', 1500));

    expect(await listSolvesChronological(freestyle.id)).toHaveLength(1);
    expect(await getGlobalPbSingle('333')).toBe(20_000);
  });

  it('lists a case oldest first, across sessions', async () => {
    await addDrillSolve(makeAttempt('pll-t', 3000));
    await addDrillSolve(makeAttempt('pll-y', 9000));
    await addDrillSolve(makeAttempt('pll-t', 2000));
    // A later drill session must not hide the earlier attempts.
    await db.sessions.clear();
    await addDrillSolve(makeAttempt('pll-t', 1000));

    const attempts = await listCaseAttempts('pll-t');
    expect(attempts.map((solve) => solve.rawMs)).toEqual([3000, 2000, 1000]);
  });

  it('ignores a freestyle solve that carries a case id', async () => {
    const freestyle = await getOrCreateActiveSession('333', 'freestyle');
    await addSolve({
      sessionId: freestyle.id,
      puzzle: '333',
      mode: 'freestyle',
      caseId: 'pll-t',
      scramble: "R U R'",
      rawMs: 20_000,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });

    expect(await listCaseAttempts('pll-t')).toEqual([]);
  });

  it('groups a whole set in one query, empty cases included', async () => {
    await addDrillSolve(makeAttempt('pll-t', 3000));
    await addDrillSolve(makeAttempt('pll-t', 2000));
    await addDrillSolve(makeAttempt('pll-y', 4000));

    const grouped = await listAttemptsByCase(['pll-t', 'pll-y', 'pll-h']);
    expect(grouped.get('pll-t')?.map((solve) => solve.rawMs)).toEqual([3000, 2000]);
    expect(grouped.get('pll-y')).toHaveLength(1);
    expect(grouped.get('pll-h')).toEqual([]);
    expect(await listAttemptsByCase([])).toEqual(new Map());
  });

  it('draws from the whole set when nothing is selected', async () => {
    await seedPacks();

    const pool = await loadDrillPool('pll');
    expect(pool).toHaveLength(21);
    expect(pool.every((entry) => entry.active !== null)).toBe(true);
  });

  it('narrows the pool to the selected cases', async () => {
    await seedPacks();

    const pool = await loadDrillPool('pll', ['pll-t', 'pll-h']);
    expect(pool.map((entry) => entry.algCase.id)).toEqual(['pll-h', 'pll-t']);
  });

  it('wipes one case without touching another', async () => {
    await addDrillSolve(makeAttempt('pll-t', 3000));
    await addDrillSolve(makeAttempt('pll-t', 2000));
    await addDrillSolve(makeAttempt('pll-y', 4000));

    const removed = await deleteCaseAttempts('pll-t');

    // Handed back so the screen can offer to put them back.
    expect(removed.map((solve) => solve.rawMs)).toEqual([3000, 2000]);
    expect(await listCaseAttempts('pll-t')).toEqual([]);
    expect(await listCaseAttempts('pll-y')).toHaveLength(1);
    // Deleted rows leave tombstones, or an old export would bring them back.
    expect(await db.tombstones.count()).toBe(2);
  });

  it('keeps the attempts when a case goes away', async () => {
    await addDrillSolve(makeAttempt('pll-t', 3000));
    await addDrillSolve(makeAttempt('pll-y', 4000));

    await detachCase('pll-t');

    expect(await listCaseAttempts('pll-t')).toEqual([]);
    expect(await listCaseAttempts('pll-y')).toHaveLength(1);
    const orphan = (await db.solves.toArray()).find((solve) => solve.caseId === null);
    expect(orphan?.rawMs).toBe(3000);
  });
});
