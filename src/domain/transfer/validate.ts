/**
 * Import validation. An import overwrites the only copy of the user's data,
 * so a file is taken as a whole or not at all: the first row that does not
 * match the entity types stops the import with the table and row index, never
 * with a half-written database.
 */

import type {
  AlgCase,
  AlgSet,
  Algorithm,
  Flag,
  Method,
  Penalty,
  CaseProgress,
  PenaltySource,
  Puzzle,
  ScrambleSource,
  Session,
  Setting,
  Solve,
  SolveMode,
  Split,
  SplitSource,
  Tag,
  Tombstone,
  Trigger,
} from '../../db/types';
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type ExportFile,
  type TransferTable,
} from './types';

export type ImportProblem =
  | { code: 'notJson' }
  | { code: 'malformed' }
  | { code: 'unknownFormat' }
  | { code: 'unsupportedVersion'; formatVersion: number }
  | { code: 'invalidRow'; table: TransferTable; index: number };

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; problem: ImportProblem };

export function parseExportFile(input: unknown): ParseResult {
  if (!isRow(input)) return fail({ code: 'malformed' });
  if (input.format !== EXPORT_FORMAT) return fail({ code: 'unknownFormat' });
  if (!isInt(input.formatVersion)) return fail({ code: 'malformed' });
  if (input.formatVersion > EXPORT_FORMAT_VERSION) {
    return fail({ code: 'unsupportedVersion', formatVersion: input.formatVersion });
  }
  if (!isInt(input.exportedAt) || !isString(input.appVersion) || !isInt(input.dbVersion)) {
    return fail({ code: 'malformed' });
  }
  if (!isRow(input.data)) return fail({ code: 'malformed' });

  const source = input.data;
  const sessions = collect(source.sessions, isSession);
  if (!sessions.ok) return fail({ code: 'invalidRow', table: 'sessions', index: sessions.index });
  const solves = collect(source.solves, isSolve);
  if (!solves.ok) return fail({ code: 'invalidRow', table: 'solves', index: solves.index });
  const tags = collect(source.tags, isTag);
  if (!tags.ok) return fail({ code: 'invalidRow', table: 'tags', index: tags.index });
  const methods = collect(source.methods, isMethod);
  if (!methods.ok) return fail({ code: 'invalidRow', table: 'methods', index: methods.index });
  const algSets = collect(source.algSets, isAlgSet);
  if (!algSets.ok) return fail({ code: 'invalidRow', table: 'algSets', index: algSets.index });
  const algCases = collect(source.algCases, isAlgCase);
  if (!algCases.ok) return fail({ code: 'invalidRow', table: 'algCases', index: algCases.index });
  const algorithms = collect(source.algorithms, isAlgorithm);
  if (!algorithms.ok) {
    return fail({ code: 'invalidRow', table: 'algorithms', index: algorithms.index });
  }
  const triggers = collect(source.triggers, isTrigger);
  if (!triggers.ok) return fail({ code: 'invalidRow', table: 'triggers', index: triggers.index });
  const settings = collect(source.settings, isSetting);
  if (!settings.ok) return fail({ code: 'invalidRow', table: 'settings', index: settings.index });
  const tombstones = collect(source.tombstones, isTombstone);
  if (!tombstones.ok) {
    return fail({ code: 'invalidRow', table: 'tombstones', index: tombstones.index });
  }

  return {
    ok: true,
    file: {
      format: EXPORT_FORMAT,
      formatVersion: input.formatVersion,
      exportedAt: input.exportedAt,
      appVersion: input.appVersion,
      dbVersion: input.dbVersion,
      data: {
        sessions: sessions.rows,
        solves: solves.rows,
        tags: tags.rows,
        methods: methods.rows,
        algSets: algSets.rows,
        algCases: algCases.rows,
        algorithms: algorithms.rows,
        triggers: triggers.rows,
        settings: settings.rows,
        tombstones: tombstones.rows,
      },
    },
  };
}

function fail(problem: ImportProblem): ParseResult {
  return { ok: false, problem };
}

type CollectResult<T> = { ok: true; rows: T[] } | { ok: false; index: number };

/** A missing table means an empty one — that is how the format grows a table. */
function collect<T>(value: unknown, guard: (row: unknown) => row is T): CollectResult<T> {
  if (value === undefined) return { ok: true, rows: [] };
  if (!Array.isArray(value)) return { ok: false, index: 0 };

  const rows: T[] = [];
  for (const [index, row] of value.entries()) {
    if (!guard(row)) return { ok: false, index };
    rows.push(row);
  }
  return { ok: true, rows };
}

/* Primitive guards. */

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Every time and every timestamp in the model is a whole millisecond. */
function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFlag(value: unknown): value is Flag {
  return value === 0 || value === 1;
}

function isNullOr<T>(value: unknown, guard: (v: unknown) => v is T): value is T | null {
  return value === null || guard(value);
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every((item) => guard(item));
}

/**
 * Enum guards read their members off a record keyed by the union, so adding a
 * puzzle or a penalty to db/types breaks the build here instead of silently
 * rejecting every file that contains one.
 */
function memberOf<T extends string>(members: Record<T, true>) {
  return (value: unknown): value is T => isString(value) && Object.hasOwn(members, value);
}

const isPuzzle = memberOf<Puzzle>({
  '333': true,
  '222': true,
  '444': true,
  '555': true,
  pyram: true,
  skewb: true,
  sq1: true,
  clock: true,
  minx: true,
});
const isSolveMode = memberOf<SolveMode>({ freestyle: true, drill: true, recognition: true });
const isPenalty = memberOf<Penalty>({ none: true, plus2: true, dnf: true });
const isPenaltySource = memberOf<PenaltySource>({ auto: true, manual: true });
const isSplitSource = memberOf<SplitSource>({ mic: true, smartcube: true, manual: true });
const isScrambleSource = memberOf<ScrambleSource>({
  generated: true,
  own: true,
  history: true,
  shared: true,
});
const isCaseProgress = memberOf<CaseProgress>({ new: true, learning: true, known: true });
const isAlgorithmSource = memberOf<Algorithm['source']>({ pack: true, user: true });
const isTriggerSource = memberOf<Trigger['source']>({ pack: true, user: true });

/* Entity guards — one per exported table. */

function isSplit(value: unknown): value is Split {
  if (!isRow(value)) return false;
  return (
    isString(value.phase) &&
    isInt(value.atMs) &&
    isSplitSource(value.source) &&
    (value.confidence === undefined || typeof value.confidence === 'number')
  );
}

function isSolve(value: unknown): value is Solve {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.sessionId) &&
    isPuzzle(value.puzzle) &&
    isSolveMode(value.mode) &&
    isNullOr(value.caseId, isString) &&
    isString(value.scramble) &&
    isScrambleSource(value.scrambleSource) &&
    isInt(value.rawMs) &&
    isPenalty(value.penalty) &&
    isPenaltySource(value.penaltySource) &&
    isNullOr(value.inspectionMs, isInt) &&
    isInt(value.startedAt) &&
    isArrayOf(value.splits, isSplit) &&
    isInt(value.splitsSchemaVersion) &&
    isArrayOf(value.tagIds, isString) &&
    isNullOr(value.note, isString) &&
    isFlag(value.starred) &&
    isNullOr(value.editedAt, isInt) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isSession(value: unknown): value is Session {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isPuzzle(value.puzzle) &&
    isSolveMode(value.mode) &&
    isString(value.methodId) &&
    isFlag(value.isArchived) &&
    isFlag(value.isActive) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isTag(value: unknown): value is Tag {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.color) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isMethodPhase(value: unknown): value is Method['phases'][number] {
  if (!isRow(value)) return false;
  return isString(value.key) && isString(value.label) && isInt(value.order);
}

function isMethod(value: unknown): value is Method {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isPuzzle(value.puzzle) &&
    isArrayOf(value.phases, isMethodPhase) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isAlgSet(value: unknown): value is AlgSet {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isPuzzle(value.puzzle) &&
    isString(value.methodId) &&
    isInt(value.packVersion) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isAlgCase(value: unknown): value is AlgCase {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.setId) &&
    isString(value.name) &&
    isNullOr(value.label, isString) &&
    isCaseProgress(value.progress) &&
    isNullOr(value.group, isString) &&
    isString(value.setupAlg) &&
    isInt(value.order) &&
    isFlag(value.isCustom) &&
    isNullOr(value.packVersion, isInt) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isAlgorithm(value: unknown): value is Algorithm {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.caseId) &&
    isString(value.moves) &&
    isFlag(value.isActive) &&
    isAlgorithmSource(value.source) &&
    isNullOr(value.packVersion, isInt) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isTrigger(value: unknown): value is Trigger {
  if (!isRow(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.moves) &&
    isTriggerSource(value.source) &&
    isFlag(value.isEnabled) &&
    isInt(value.createdAt) &&
    isInt(value.updatedAt)
  );
}

function isSetting(value: unknown): value is Setting {
  if (!isRow(value)) return false;
  return (
    isString(value.key) &&
    Object.hasOwn(value, 'value') &&
    isFlag(value.deviceLocal) &&
    isInt(value.updatedAt)
  );
}

function isTombstone(value: unknown): value is Tombstone {
  if (!isRow(value)) return false;
  return isString(value.id) && isString(value.table) && isInt(value.deletedAt);
}
