import { db } from '../schema';
import type { Setting } from '../types';
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type ExportData,
  type ExportFile,
} from '../../domain/transfer/types';
import type { ImportPlan } from '../../domain/transfer/merge';
import { now } from '../../lib/clock';

/**
 * Reads every table, including device-local settings. This is the picture an
 * import is planned against, not the picture that gets written to a file.
 *
 * Rows come out sorted by primary key so two exports of the same data are
 * identical byte for byte, whatever order IndexedDB happened to return.
 */
export async function readSnapshot(): Promise<ExportData> {
  const [sessions, solves, tags, methods, algSets, algCases, algorithms, triggers, settings, tombstones] =
    await Promise.all([
      db.sessions.toArray(),
      db.solves.toArray(),
      db.tags.toArray(),
      db.methods.toArray(),
      db.algSets.toArray(),
      db.algCases.toArray(),
      db.algorithms.toArray(),
      db.triggers.toArray(),
      db.settings.toArray(),
      db.tombstones.toArray(),
    ]);

  return {
    sessions: sortById(sessions),
    solves: sortById(solves),
    tags: sortById(tags),
    methods: sortById(methods),
    algSets: sortById(algSets),
    algCases: sortById(algCases),
    algorithms: sortById(algorithms),
    triggers: sortById(triggers),
    settings: sortBy(settings, (setting) => setting.key),
    tombstones: sortById(tombstones),
  };
}

/**
 * The file the user downloads. Device-local settings stay behind: mic
 * calibration and the chosen audio input describe this device, and restoring
 * them onto another one would be wrong, not helpful.
 */
export async function buildExportFile(appVersion: string): Promise<ExportFile> {
  const data = await readSnapshot();

  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: now(),
    appVersion,
    dbVersion: db.verno,
    data: { ...data, settings: exportableSettings(data.settings) },
  };
}

/**
 * Applies a plan in a single transaction: either the whole file lands or the
 * database is untouched. Deletes come from tombstones that are written in the
 * same pass, so nothing is removed without a record of the removal.
 */
export async function applyImportPlan(plan: ImportPlan): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    if (plan.mode === 'replace') {
      await Promise.all(db.tables.map((table) => table.clear()));
    }

    await db.sessions.bulkPut(plan.puts.sessions);
    await db.solves.bulkPut(plan.puts.solves);
    await db.tags.bulkPut(plan.puts.tags);
    await db.methods.bulkPut(plan.puts.methods);
    await db.algSets.bulkPut(plan.puts.algSets);
    await db.algCases.bulkPut(plan.puts.algCases);
    await db.algorithms.bulkPut(plan.puts.algorithms);
    await db.triggers.bulkPut(plan.puts.triggers);
    await db.settings.bulkPut(plan.puts.settings);
    await db.tombstones.bulkPut(plan.puts.tombstones);

    if (plan.mode === 'merge') {
      await db.sessions.bulkDelete(plan.deletes.sessions);
      await db.solves.bulkDelete(plan.deletes.solves);
      await db.tags.bulkDelete(plan.deletes.tags);
      await db.methods.bulkDelete(plan.deletes.methods);
      await db.algSets.bulkDelete(plan.deletes.algSets);
      await db.algCases.bulkDelete(plan.deletes.algCases);
      await db.algorithms.bulkDelete(plan.deletes.algorithms);
      await db.triggers.bulkDelete(plan.deletes.triggers);
      await db.settings.bulkDelete(plan.deletes.settings);
    }
  });
}

/**
 * Wipes the database, tombstones included. This is the one delete that leaves
 * no trace on purpose: tombstones for everything would make the user's own
 * backup unimportable afterwards.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}

function exportableSettings(settings: readonly Setting[]): Setting[] {
  return settings.filter((setting) => setting.deviceLocal === 0);
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return sortBy(rows, (row) => row.id);
}

/** Code-unit order, not locale order — a backup must not depend on the device. */
function sortBy<T>(rows: T[], keyOf: (row: T) => string): T[] {
  return [...rows].sort((a, b) => {
    const left = keyOf(a);
    const right = keyOf(b);
    if (left < right) return -1;
    return left > right ? 1 : 0;
  });
}
