import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { applyCsTimerPlan, readSolveKeys } from './cstimer-repository';
import { addSolve } from './solve-repository';
import { getOrCreateActiveSession } from './session-repository';
import { parseCsTimerJson, planCsTimerImport } from '../../domain/transfer/cstimer';

const PHASES = ['cross', 'f2l', 'oll', 'pll'];

/** [[penalty, phase ends…], scramble, comment, unix seconds]. */
function record(times: number[], at: number, comment = ''): unknown {
  return [times, "R U R' U'", comment, at];
}

function exportFile(sessions: Record<string, unknown[]>, meta: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ...sessions,
    properties: { sessionData: JSON.stringify(meta) },
  });
}

/** The whole way in: parse, plan against what is stored, write. */
async function importFile(text: string): Promise<number> {
  const parsed = parseCsTimerJson(text);
  if (!parsed.ok) throw new Error(`unreadable file: ${parsed.problem}`);
  const plan = planCsTimerImport(parsed.file, await readSolveKeys(), PHASES.length);
  return applyCsTimerPlan(plan, PHASES);
}

describe('csTimer import', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('gives every csTimer session a session of its own, under its own name', async () => {
    await importFile(
      exportFile(
        {
          session1: [record([0, 12_340], 1_788_509_385)],
          session2: [record([0, 9870], 1_788_509_400)],
        },
        {
          1: { name: 'Evening', opt: {}, rank: 1 },
          2: { name: '2x2 warm up', opt: { scrType: '222so' }, rank: 2 },
        },
      ),
    );

    const sessions = (await db.sessions.toArray()).sort((a, b) => a.createdAt - b.createdAt);
    expect(sessions.map((session) => [session.name, session.puzzle])).toEqual([
      ['Evening', '333'],
      ['2x2 warm up', '222'],
    ]);
  });

  it('never makes an imported session the active one', async () => {
    const active = await getOrCreateActiveSession('333', 'freestyle');
    await importFile(exportFile({ session1: [record([0, 12_340], 1_788_509_385)] }));

    const imported = (await db.sessions.toArray()).find((session) => session.name === '1');
    expect(imported?.isActive).toBe(0);
    expect((await db.sessions.get(active.id))?.isActive).toBe(1);
  });

  it('stores the solve as csTimer had it, at the time it happened', async () => {
    await importFile(
      exportFile({ session1: [record([2000, 12_340], 1_788_509_385, 'bad F2L')] }),
    );

    const solve = await db.solves.toCollection().first();
    expect(solve).toMatchObject({
      rawMs: 12_340,
      penalty: 'plus2',
      // Not 'auto' — this app's inspection did not decide it.
      penaltySource: 'manual',
      scramble: "R U R' U'",
      note: 'bad F2L',
      inspectionMs: null,
      startedAt: 1_788_509_385_000,
      createdAt: 1_788_509_385_000,
      mode: 'freestyle',
      caseId: null,
    });
  });

  it('turns four csTimer phases into the four phases of the method', async () => {
    await importFile(
      exportFile({ session1: [record([0, 12_000, 10_000, 8000, 2000], 1_788_509_385)] }),
    );

    const solve = await db.solves.toCollection().first();
    // Interior boundaries only; the last phase is closed by rawMs.
    expect(solve?.splits).toEqual([
      { phase: 'cross', atMs: 2000, source: 'manual' },
      { phase: 'f2l', atMs: 8000, source: 'manual' },
      { phase: 'oll', atMs: 10_000, source: 'manual' },
    ]);
  });

  it('imports a solve timed in some other number of phases without them', async () => {
    await importFile(
      exportFile({ session1: [record([0, 12_000, 5000], 1_788_509_385)] }),
    );

    const solve = await db.solves.toCollection().first();
    expect(solve?.rawMs).toBe(12_000);
    expect(solve?.splits).toEqual([]);
  });

  it('imports the same file twice without doubling anything', async () => {
    const file = exportFile({
      session1: [record([0, 12_340], 1_788_509_385), record([-1, 9870], 1_788_509_400)],
    });

    expect(await importFile(file)).toBe(2);
    expect(await importFile(file)).toBe(0);

    expect(await db.solves.count()).toBe(2);
    // And no empty session left behind by the second run.
    expect(await db.sessions.count()).toBe(1);
  });

  it('does not import a solve the user already has from the timer', async () => {
    const session = await getOrCreateActiveSession('333', 'freestyle');
    await addSolve({
      sessionId: session.id,
      puzzle: '333',
      mode: 'freestyle',
      scramble: "R U R' U'",
      rawMs: 12_340,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: 1_788_509_385_000,
    });

    const imported = await importFile(
      exportFile({ session1: [record([0, 12_340], 1_788_509_385)] }),
    );

    expect(imported).toBe(0);
    expect(await db.solves.count()).toBe(1);
  });

  it('brings in a file the size of a real history', async () => {
    const solves = Array.from({ length: 600 }, (_, index) =>
      record([0, 10_000 + index], 1_788_000_000 + index),
    );

    const progress: number[] = [];
    const parsed = parseCsTimerJson(exportFile({ session1: solves }));
    if (!parsed.ok) throw new Error('unreadable');
    const plan = planCsTimerImport(parsed.file, await readSolveKeys(), PHASES.length);
    const written = await applyCsTimerPlan(plan, PHASES, (p) => progress.push(p.written));

    expect(written).toBe(600);
    expect(await db.solves.count()).toBe(600);
    // Written in batches, and the count is reported as they land.
    expect(progress.at(0)).toBe(0);
    expect(progress.at(-1)).toBe(600);
    expect(progress.length).toBeGreaterThan(2);
  });

  it('leaves a session csTimer timed on a puzzle this app has no name for', async () => {
    const parsed = parseCsTimerJson(
      exportFile(
        { session1: [record([0, 60_000], 1_788_509_385)] },
        { 1: { name: '6x6', opt: { scrType: '666wca' }, rank: 1 } },
      ),
    );
    if (!parsed.ok) throw new Error('unreadable');

    const plan = planCsTimerImport(parsed.file, await readSolveKeys(), PHASES.length);
    await applyCsTimerPlan(plan, PHASES);

    expect(plan.unsupported).toEqual([{ name: '6x6', scrambleType: '666wca', solves: 1 }]);
    expect(await db.solves.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });
});
