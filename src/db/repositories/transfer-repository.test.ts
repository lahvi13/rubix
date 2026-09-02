import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../schema';
import { addSolve } from './solve-repository';
import { createSession } from './session-repository';
import { createTag, deleteTag } from './tag-repository';
import { setSetting } from './settings-repository';
import {
  applyImportPlan,
  buildExportFile,
  clearAllData,
  readSnapshot,
} from './transfer-repository';
import { planImport } from '../../domain/transfer/merge';
import { parseExportFile } from '../../domain/transfer/validate';

const APP_VERSION = '0.4.0';

/** Two exports of the same data differ only in when they were taken. */
function withoutExportTime(json: string): string {
  return json.replace(/"exportedAt":\d+/, '"exportedAt":0');
}

async function seedDevice(): Promise<void> {
  const session = await createSession('Evening', '333', 'freestyle');
  const tag = await createTag('one-handed');

  for (const rawMs of [12_340, 9_870, 15_020]) {
    await addSolve({
      sessionId: session.id,
      puzzle: '333',
      mode: 'freestyle',
      scramble: "R U R' U'",
      rawMs,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: 9_000,
      startedAt: Date.now(),
    });
  }

  await setSetting('timer.holdThresholdMs', 500);
  await setSetting('audio.thresholdDb', -24);

  // A deletion has to travel with the data, or the next import brings it back.
  const throwaway = await createTag('typo');
  await deleteTag(throwaway.id);
  expect(tag.id).toBeTruthy();
}

describe('transfer repository', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });

  it('survives a full round trip: export, replace, export again', async () => {
    await seedDevice();
    const first = JSON.stringify(await buildExportFile(APP_VERSION));

    const parsed = parseExportFile(JSON.parse(first));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await applyImportPlan(planImport('replace', await readSnapshot(), parsed.file.data));
    const second = JSON.stringify(await buildExportFile(APP_VERSION));

    expect(withoutExportTime(second)).toBe(withoutExportTime(first));
  });

  it('imports into an empty device and restores every table', async () => {
    await seedDevice();
    const file = await buildExportFile(APP_VERSION);
    await clearAllData();

    await applyImportPlan(planImport('merge', await readSnapshot(), file.data));

    expect(await db.solves.count()).toBe(3);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.tags.count()).toBe(1);
    expect(await db.tombstones.count()).toBe(1);
  });

  it('leaves device-local settings out of the file but keeps them in the database', async () => {
    await seedDevice();

    const snapshot = await readSnapshot();
    const file = await buildExportFile(APP_VERSION);

    expect(snapshot.settings.map((s) => s.key)).toContain('audio.thresholdDb');
    expect(file.data.settings.map((s) => s.key)).not.toContain('audio.thresholdDb');
    expect(file.data.settings.map((s) => s.key)).toContain('timer.holdThresholdMs');
  });

  it('keeps this device its calibration through a replace', async () => {
    await seedDevice();
    const file = await buildExportFile(APP_VERSION);
    await setSetting('audio.thresholdDb', -12);

    await applyImportPlan(planImport('replace', await readSnapshot(), file.data));

    expect((await db.settings.get('audio.thresholdDb'))?.value).toBe(-12);
  });

  it('drops everything the file does not contain when replacing', async () => {
    await seedDevice();
    const file = await buildExportFile(APP_VERSION);

    const other = await createSession('Morning', '333', 'freestyle');
    await addSolve({
      sessionId: other.id,
      puzzle: '333',
      mode: 'freestyle',
      scramble: 'U',
      rawMs: 8_000,
      penalty: 'none',
      penaltySource: 'auto',
      inspectionMs: null,
      startedAt: Date.now(),
    });

    await applyImportPlan(planImport('replace', await readSnapshot(), file.data));

    expect(await db.solves.count()).toBe(3);
    expect(await db.sessions.get(other.id)).toBeUndefined();
  });

  it('applies a merge as one transaction: rows written, tombstoned rows removed', async () => {
    await seedDevice();
    const file = await buildExportFile(APP_VERSION);

    const [victim] = await db.solves.toArray();
    expect(victim).toBeDefined();
    if (!victim) return;

    // The file says the solve is gone and a fourth one exists.
    const remaining = file.data.solves.filter((solve) => solve.id !== victim.id);
    const extra = { ...victim, id: 'imported-solve', updatedAt: victim.updatedAt + 1 };

    await applyImportPlan(
      planImport('merge', await readSnapshot(), {
        ...file.data,
        solves: [...remaining, extra],
        tombstones: [
          ...file.data.tombstones,
          { id: victim.id, table: 'solves', deletedAt: victim.updatedAt + 1 },
        ],
      }),
    );

    expect(await db.solves.get(victim.id)).toBeUndefined();
    expect(await db.solves.get('imported-solve')).toBeDefined();
    expect(await db.solves.count()).toBe(3);
  });

  it('sorts rows so two exports of the same data are identical', async () => {
    await seedDevice();

    const first = await buildExportFile(APP_VERSION);
    const second = await buildExportFile(APP_VERSION);

    expect(JSON.stringify(second.data)).toBe(JSON.stringify(first.data));
    expect(first.data.solves.map((s) => s.id)).toEqual(
      [...first.data.solves.map((s) => s.id)].sort(),
    );
  });

  it('wipes everything, tombstones included, so a backup can be restored afterwards', async () => {
    await seedDevice();

    await clearAllData();

    const counts = await Promise.all(db.tables.map((table) => table.count()));
    expect(counts.every((count) => count === 0)).toBe(true);
  });
});
