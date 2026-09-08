import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { addDrillSolve } from './drill-repository';
import { listCaseAttempts } from './drill-repository';
import {
  addRecognitionAttempt,
  deleteCaseRecognitions,
  listCaseRecognitions,
  listRecognitionsByCase,
  type NewRecognitionAttempt,
} from './recognition-repository';
import { getActiveSession, getOrCreateActiveSession } from './session-repository';
import { getGlobalPbSingle, listSolvesChronological } from './solve-repository';

function makeAttempt(
  caseId: string,
  rawMs: number,
  isCorrect = true,
): NewRecognitionAttempt {
  return {
    puzzle: '333',
    caseId,
    scramble: "y R U R' U'",
    rawMs,
    isCorrect,
    startedAt: Date.now(),
  };
}

describe('recognition repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('stores an attempt against its case', async () => {
    const solve = await addRecognitionAttempt(makeAttempt('pll-t', 1200));

    expect(solve.mode).toBe('recognition');
    expect(solve.caseId).toBe('pll-t');
    expect(solve.rawMs).toBe(1200);
    expect(solve.penalty).toBe('none');
  });

  it('counts a wrong answer as a DNF the app judged', async () => {
    const solve = await addRecognitionAttempt(makeAttempt('pll-t', 900, false));

    expect(solve.penalty).toBe('dnf');
    expect(solve.penaltySource).toBe('auto');
  });

  it('recognises into a session of its own, beside the drill and the timer', async () => {
    const freestyle = await getOrCreateActiveSession('333', 'freestyle');
    const drill = await addDrillSolve({
      puzzle: '333',
      caseId: 'pll-t',
      scramble: '',
      rawMs: 2500,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });
    const solve = await addRecognitionAttempt(makeAttempt('pll-t', 1200));

    expect(solve.sessionId).not.toBe(freestyle.id);
    expect(solve.sessionId).not.toBe(drill.sessionId);
    expect((await getActiveSession('333', 'recognition'))?.id).toBe(solve.sessionId);
  });

  it('keeps recognitions out of the history and the personal best', async () => {
    await addRecognitionAttempt(makeAttempt('pll-t', 900));

    const session = await getOrCreateActiveSession('333', 'freestyle');
    expect(await listSolvesChronological(session.id)).toHaveLength(0);
    expect(await getGlobalPbSingle('333')).toBeNull();
  });

  it('keeps the two kinds of practice apart on the same case', async () => {
    await addRecognitionAttempt(makeAttempt('pll-t', 900));
    await addDrillSolve({
      puzzle: '333',
      caseId: 'pll-t',
      scramble: '',
      rawMs: 2500,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });

    expect(await listCaseRecognitions('pll-t')).toHaveLength(1);
    expect(await listCaseAttempts('pll-t')).toHaveLength(1);
    expect((await listCaseRecognitions('pll-t'))[0]?.rawMs).toBe(900);
  });

  it('returns attempts oldest first, grouped by case', async () => {
    await addRecognitionAttempt(makeAttempt('pll-t', 1500));
    await addRecognitionAttempt(makeAttempt('pll-t', 900));
    await addRecognitionAttempt(makeAttempt('pll-y', 1100));

    const grouped = await listRecognitionsByCase(['pll-t', 'pll-y', 'pll-h']);
    expect(grouped.get('pll-t')?.map((solve) => solve.rawMs)).toEqual([1500, 900]);
    expect(grouped.get('pll-y')).toHaveLength(1);
    // A case with nothing on it is present and empty, not missing.
    expect(grouped.get('pll-h')).toEqual([]);
  });

  it('forgets one case without touching its drills or another case', async () => {
    await addRecognitionAttempt(makeAttempt('pll-t', 900));
    await addDrillSolve({
      puzzle: '333',
      caseId: 'pll-t',
      scramble: '',
      rawMs: 2500,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });
    await addRecognitionAttempt(makeAttempt('pll-y', 1100));

    await deleteCaseRecognitions('pll-t');

    expect(await listCaseRecognitions('pll-t')).toHaveLength(0);
    expect(await listCaseAttempts('pll-t')).toHaveLength(1);
    expect(await listCaseRecognitions('pll-y')).toHaveLength(1);
    // Deleted, not merely hidden: an import must not bring it back.
    expect(await db.tombstones.count()).toBe(1);
  });
});
