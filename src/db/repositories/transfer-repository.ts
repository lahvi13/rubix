import { db } from '../schema';
import type { Setting } from '../types';
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type ExportData,
  type ExportFile,
} from '../../domain/transfer/types';
import type { ImportPlan } from '../../domain/transfer/merge';
import type { RecordCounts } from '../../domain/transfer/backup-reminder';
import { countRecordsChangedSince } from './solve-repository';
import { supersededActives } from '../../domain/transfer/actives';
import { now } from '../../lib/clock';

/**
 * What a backup taken at `timestamp` does not hold as it is now. The solves
 * table is counted by kind on its index; the reader's own algorithms are a
 * handful of rows, and the only algorithms worth naming — the pack's are put
 * back by every start, and never touched by the reader except to pick one.
 */
export async function countChangedSince(timestamp: number): Promise<RecordCounts> {
  const [records, algorithms] = await Promise.all([
    countRecordsChangedSince(timestamp),
    db.algorithms
      .where('updatedAt')
      .above(timestamp)
      .filter((algorithm) => algorithm.source === 'user')
      .count(),
  ]);
  return { ...records, algorithms };
}

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
 *
 * Deletes go first. A row the file deleted and then brought back is in both
 * lists, and deleting it after writing it lost it again; and a tag buried by
 * the file still held its name against the one written in its place.
 */
export async function applyImportPlan(plan: ImportPlan): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    if (plan.mode === 'replace') {
      await Promise.all(db.tables.map((table) => table.clear()));
    }

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

    await settleActives();
  });
}

/**
 * One active session per puzzle and mode, one active algorithm per case —
 * which a merge breaks as a matter of course, since each device has its own.
 * Left alone, the timer used one session while the picker hid the other as
 * already chosen, and a case's card and its sheet named different algorithms.
 *
 * Whole tables rather than an index: there is no index on the flag alone,
 * both tables are small, and an import is rare.
 */
async function settleActives(): Promise<void> {
  const at = now();
  const [sessions, algorithms] = await Promise.all([
    db.sessions.toArray(),
    db.algorithms.toArray(),
  ]);
  const switchedOff = { isActive: 0 as const, updatedAt: at };

  await db.sessions.bulkUpdate(
    supersededActives(sessions, (session) => `${session.puzzle} ${session.mode}`).map((key) => ({
      key,
      changes: switchedOff,
    })),
  );
  await db.algorithms.bulkUpdate(
    supersededActives(algorithms, (algorithm) => algorithm.caseId).map((key) => ({
      key,
      changes: switchedOff,
    })),
  );
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
