/**
 * Solves as a spreadsheet. A one-way road on purpose: the JSON export is the
 * backup, and this is the file somebody opens in Excel to draw their own
 * chart. Nothing here is ever read back, so it is free to be readable rather
 * than exact — names instead of ids, phase lengths instead of the cumulative
 * boundaries the database stores.
 *
 * RFC 4180: fields quoted only when they need it, rows ended with CRLF.
 */

import type { Method, Solve } from '../../db/types';
import { finalMs, penaltyLabel } from '../solve/final-time';
import { phaseDurations } from '../solve/splits';
import type { ExportData } from './types';

/**
 * How the device writes a date and a time. Injected because neither belongs in
 * a pure function: both depend on where the user is, and a test that had to
 * know the timezone would be a test of the timezone.
 */
export interface CsvFormat {
  dateTime: (timestamp: number) => string;
  /** A result the way the app shows it, DNF included. */
  time: (ms: number | null) => string;
}

const FIXED_COLUMNS = [
  'date',
  'session',
  'puzzle',
  'mode',
  'case',
  'time',
  'penalty',
  'finalMs',
  'rawMs',
  'inspectionMs',
  'starred',
  'scramble',
  'note',
  'tags',
] as const;

export function solvesToCsv(data: ExportData, format: CsvFormat): string {
  const sessions = new Map(data.sessions.map((session) => [session.id, session]));
  const cases = new Map(data.algCases.map((algCase) => [algCase.id, algCase]));
  const tags = new Map(data.tags.map((tag) => [tag.id, tag]));
  const methods = new Map(data.methods.map((method) => [method.id, method]));
  const phaseKeys = allPhaseKeys(data.methods);

  const header = [...FIXED_COLUMNS, ...phaseKeys.map((key) => `${key}Ms`)];
  // Oldest first: a spreadsheet is read down the page, and every rolling
  // average in the app is defined over that same order.
  const rows = [...data.solves].sort((a, b) => a.createdAt - b.createdAt);

  return [header, ...rows.map((solve) => row(solve))].map(toLine).join('\r\n');

  function row(solve: Solve): string[] {
    const session = sessions.get(solve.sessionId);
    const method = session === undefined ? undefined : methods.get(session.methodId);
    const result = finalMs(solve);

    return [
      format.dateTime(solve.createdAt),
      session?.name ?? '',
      solve.puzzle,
      solve.mode,
      solve.caseId === null ? '' : (cases.get(solve.caseId)?.name ?? ''),
      format.time(result),
      penaltyLabel(solve.penalty),
      result === null ? '' : String(result),
      String(solve.rawMs),
      solve.inspectionMs === null ? '' : String(solve.inspectionMs),
      String(solve.starred),
      solve.scramble,
      solve.note ?? '',
      // Tag names can contain a comma or a space, so neither can separate them.
      solve.tagIds.map((id) => tags.get(id)?.name ?? '').join('|'),
      ...phaseCells(solve, method, phaseKeys),
    ];
  }
}

/**
 * One column per phase any method in the file has, in method order. Lengths,
 * not boundaries: a column of "how long the cross took" is what a spreadsheet
 * can average, and the boundaries can be added back up from it.
 */
function phaseCells(
  solve: Solve,
  method: Method | undefined,
  columns: readonly string[],
): string[] {
  if (method === undefined || solve.splits.length === 0) return columns.map(() => '');

  const keys = orderedPhases(method);
  const byPhase = new Map(
    phaseDurations(solve.splits, keys, solve.rawMs).map((phase) => [phase.phase, phase.ms]),
  );
  return columns.map((column) => {
    const ms = byPhase.get(column);
    return ms === undefined || ms === null ? '' : String(ms);
  });
}

function allPhaseKeys(methods: readonly Method[]): string[] {
  const keys: string[] = [];
  for (const method of [...methods].sort((a, b) => compare(a.id, b.id))) {
    for (const key of orderedPhases(method)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

function orderedPhases(method: Method): string[] {
  return [...method.phases].sort((a, b) => a.order - b.order).map((phase) => phase.key);
}

function toLine(cells: readonly string[]): string {
  return cells.map(escape).join(',');
}

function escape(cell: string): string {
  return /["\n\r,]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

function compare(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
