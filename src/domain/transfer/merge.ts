/**
 * Import planning. Pure: it takes the rows currently in the database and the
 * rows from a file and decides what would change. The preview the user
 * confirms and the write that follows are the same plan, so the numbers on
 * screen cannot disagree with what lands in the database.
 *
 * Merge is last-writer-wins per row, with deletions as first-class events: a
 * tombstone removes a row unless the row was edited after the deletion
 * happened. Both sides' tombstones count, which is what makes the direction of
 * the import irrelevant — importing A into B and B into A converge.
 */

import type { Setting, Tombstone } from '../../db/types';
import type { ExportData, TransferTable } from './types';

export type ImportMode = 'merge' | 'replace';

export interface TableCounts {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

export type ImportCounts = { [K in TransferTable]: TableCounts };

export interface ImportPlan {
  mode: ImportMode;
  /** Rows to write. In replace mode this is the entire content of the tables. */
  puts: ExportData;
  /** Primary keys to remove — settings by `key`, every other table by `id`. */
  deletes: { [K in TransferTable]: string[] };
  counts: ImportCounts;
}

export function planImport(
  mode: ImportMode,
  local: ExportData,
  incoming: ExportData,
): ImportPlan {
  return mode === 'merge' ? planMerge(local, incoming) : planReplace(local, incoming);
}

export function totalCounts(counts: ImportCounts): TableCounts {
  const total: TableCounts = { added: 0, updated: 0, deleted: 0, unchanged: 0 };
  for (const table of Object.values(counts)) {
    total.added += table.added;
    total.updated += table.updated;
    total.deleted += table.deleted;
    total.unchanged += table.unchanged;
  }
  return total;
}

export function hasChanges(counts: ImportCounts): boolean {
  const total = totalCounts(counts);
  return total.added + total.updated + total.deleted > 0;
}

/* Planning. */

function planMerge(local: ExportData, incoming: ExportData): ImportPlan {
  const localGraves = indexGraves(local.tombstones);
  const incomingGraves = indexGraves(incoming.tombstones);
  const protectedKeys = deviceLocalKeys(local.settings);

  const byId = <T extends { id: string; updatedAt: number }>(
    table: TransferTable,
    localRows: readonly T[],
    incomingRows: readonly T[],
  ) =>
    mergeRows({
      table,
      local: localRows,
      incoming: incomingRows,
      keyOf: (row) => row.id,
      timeOf: (row) => row.updatedAt,
      localGraves,
      incomingGraves,
      protectedKeys: NO_KEYS,
    });

  const sessions = byId('sessions', local.sessions, incoming.sessions);
  const solves = byId('solves', local.solves, incoming.solves);
  const tags = byId('tags', local.tags, incoming.tags);
  const methods = byId('methods', local.methods, incoming.methods);
  const algSets = byId('algSets', local.algSets, incoming.algSets);
  const algCases = byId('algCases', local.algCases, incoming.algCases);
  const algorithms = byId('algorithms', local.algorithms, incoming.algorithms);

  const settings = mergeRows({
    table: 'settings',
    local: local.settings,
    incoming: importableSettings(incoming.settings, protectedKeys),
    keyOf: (row) => row.key,
    timeOf: (row) => row.updatedAt,
    localGraves,
    incomingGraves,
    protectedKeys,
  });

  // Tombstones are never deleted by an import and nothing buries them; they
  // only ever accumulate, so the newest deletion of an id wins.
  const tombstones = mergeRows({
    table: 'tombstones',
    local: local.tombstones,
    incoming: incoming.tombstones,
    keyOf: (row) => row.id,
    timeOf: (row) => row.deletedAt,
    localGraves: NO_GRAVES,
    incomingGraves: NO_GRAVES,
    protectedKeys: NO_KEYS,
  });

  return assemble('merge', {
    sessions,
    solves,
    tags,
    methods,
    algSets,
    algCases,
    algorithms,
    settings,
    tombstones,
  });
}

/**
 * Replace throws away everything not in the file — except device-local
 * settings, which describe this device (mic calibration, chosen input) and
 * would be nonsense to take from another one.
 */
function planReplace(local: ExportData, incoming: ExportData): ImportPlan {
  const protectedKeys = deviceLocalKeys(local.settings);
  const keptSettings = local.settings.filter((setting) => setting.deviceLocal === 1);

  const byId = <T extends { id: string; updatedAt: number }>(
    localRows: readonly T[],
    incomingRows: readonly T[],
  ) =>
    replaceRows({
      local: localRows,
      incoming: incomingRows,
      kept: [],
      keyOf: (row) => row.id,
      timeOf: (row) => row.updatedAt,
    });

  return assemble('replace', {
    sessions: byId(local.sessions, incoming.sessions),
    solves: byId(local.solves, incoming.solves),
    tags: byId(local.tags, incoming.tags),
    methods: byId(local.methods, incoming.methods),
    algSets: byId(local.algSets, incoming.algSets),
    algCases: byId(local.algCases, incoming.algCases),
    algorithms: byId(local.algorithms, incoming.algorithms),
    settings: replaceRows({
      local: local.settings,
      incoming: importableSettings(incoming.settings, protectedKeys),
      kept: keptSettings,
      keyOf: (row) => row.key,
      timeOf: (row) => row.updatedAt,
    }),
    tombstones: replaceRows({
      local: local.tombstones,
      incoming: incoming.tombstones,
      kept: [],
      keyOf: (row) => row.id,
      timeOf: (row) => row.deletedAt,
    }),
  });
}

/* Row-level rules. */

type Graves = ReadonlyMap<string, number>;

interface TableResult<T> {
  puts: T[];
  deletes: string[];
  counts: TableCounts;
}

interface MergeInput<T> {
  table: TransferTable;
  local: readonly T[];
  incoming: readonly T[];
  keyOf: (row: T) => string;
  timeOf: (row: T) => number;
  localGraves: Graves;
  incomingGraves: Graves;
  protectedKeys: ReadonlySet<string>;
}

function mergeRows<T>(input: MergeInput<T>): TableResult<T> {
  const { table, keyOf, timeOf } = input;
  const localByKey = new Map(input.local.map((row) => [keyOf(row), row]));

  const puts: T[] = [];
  const deletes: string[] = [];
  const counts: TableCounts = { added: 0, updated: 0, deleted: 0, unchanged: 0 };

  for (const row of input.incoming) {
    const key = keyOf(row);
    if (input.protectedKeys.has(key)) continue;

    const time = timeOf(row);
    const buriedAt = latest(
      input.localGraves.get(graveKey(table, key)),
      input.incomingGraves.get(graveKey(table, key)),
    );
    // The row was deleted after this copy of it was written, so the deletion
    // is the newer fact and the row stays gone.
    if (buriedAt !== undefined && buriedAt >= time) continue;

    const current = localByKey.get(key);
    if (current === undefined) {
      puts.push(row);
      counts.added += 1;
    } else if (time > timeOf(current)) {
      puts.push(row);
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }

  for (const [key, row] of localByKey) {
    if (input.protectedKeys.has(key)) continue;

    const deletedAt = input.incomingGraves.get(graveKey(table, key));
    if (deletedAt !== undefined && deletedAt >= timeOf(row)) {
      deletes.push(key);
      counts.deleted += 1;
    }
  }

  return { puts, deletes, counts };
}

interface ReplaceInput<T> {
  local: readonly T[];
  incoming: readonly T[];
  /** Local rows that survive a replace regardless of the file. */
  kept: readonly T[];
  keyOf: (row: T) => string;
  timeOf: (row: T) => number;
}

function replaceRows<T>(input: ReplaceInput<T>): TableResult<T> {
  const { keyOf, timeOf } = input;
  const localByKey = new Map(input.local.map((row) => [keyOf(row), row]));
  const keptKeys = new Set(input.kept.map((row) => keyOf(row)));
  const incomingKeys = new Set(input.incoming.map((row) => keyOf(row)));

  const counts: TableCounts = { added: 0, updated: 0, deleted: 0, unchanged: 0 };
  for (const row of input.incoming) {
    const current = localByKey.get(keyOf(row));
    if (current === undefined) counts.added += 1;
    else if (timeOf(current) === timeOf(row)) counts.unchanged += 1;
    else counts.updated += 1;
  }
  for (const [key] of localByKey) {
    if (keptKeys.has(key)) {
      counts.unchanged += 1;
      continue;
    }
    if (!incomingKeys.has(key)) counts.deleted += 1;
  }

  // The repository clears the tables first, so a replace never needs deletes.
  return { puts: [...input.kept, ...input.incoming], deletes: [], counts };
}

/* Helpers. */

const NO_KEYS: ReadonlySet<string> = new Set();
const NO_GRAVES: Graves = new Map();

/**
 * Tombstones are stored keyed by the deleted entity's id alone, but a merge
 * must not let a deleted tag delete an alg case that happens to share an id
 * (pack ids are hand-written, not UUIDs).
 */
function graveKey(table: string, key: string): string {
  return `${table} ${key}`;
}

function indexGraves(tombstones: readonly Tombstone[]): Graves {
  const graves = new Map<string, number>();
  for (const stone of tombstones) {
    const key = graveKey(stone.table, stone.id);
    const current = graves.get(key);
    if (current === undefined || stone.deletedAt > current) graves.set(key, stone.deletedAt);
  }
  return graves;
}

function latest(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

function deviceLocalKeys(settings: readonly Setting[]): ReadonlySet<string> {
  return new Set(settings.filter((setting) => setting.deviceLocal === 1).map((s) => s.key));
}

/**
 * A well-formed export contains no device-local settings, but a hand-edited or
 * hand-merged file might. Ignoring them here means calibration from another
 * device can never overwrite this one's.
 */
function importableSettings(
  settings: readonly Setting[],
  protectedKeys: ReadonlySet<string>,
): Setting[] {
  return settings.filter(
    (setting) => setting.deviceLocal === 0 && !protectedKeys.has(setting.key),
  );
}

type Results = { [K in TransferTable]: TableResult<ExportData[K][number]> };

function assemble(mode: ImportMode, results: Results): ImportPlan {
  return {
    mode,
    puts: {
      sessions: results.sessions.puts,
      solves: results.solves.puts,
      tags: results.tags.puts,
      methods: results.methods.puts,
      algSets: results.algSets.puts,
      algCases: results.algCases.puts,
      algorithms: results.algorithms.puts,
      settings: results.settings.puts,
      tombstones: results.tombstones.puts,
    },
    deletes: {
      sessions: results.sessions.deletes,
      solves: results.solves.deletes,
      tags: results.tags.deletes,
      methods: results.methods.deletes,
      algSets: results.algSets.deletes,
      algCases: results.algCases.deletes,
      algorithms: results.algorithms.deletes,
      settings: results.settings.deletes,
      tombstones: results.tombstones.deletes,
    },
    counts: {
      sessions: results.sessions.counts,
      solves: results.solves.counts,
      tags: results.tags.counts,
      methods: results.methods.counts,
      algSets: results.algSets.counts,
      algCases: results.algCases.counts,
      algorithms: results.algorithms.counts,
      settings: results.settings.counts,
      tombstones: results.tombstones.counts,
    },
  };
}
