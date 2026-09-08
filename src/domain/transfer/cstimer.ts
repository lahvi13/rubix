/**
 * Reading csTimer's two export formats.
 *
 * The shapes below are not guessed — they are what csTimer's own source
 * writes (src/js/stats/stats.js, src/js/kernel.js), checked against a real
 * export:
 *
 *   {"session1": [ solve, ... ], ..., "properties": {"sessionData": "<json>"}}
 *
 * and one solve is
 *
 *   [[penalty, phaseN end, phaseN-1 end, ..., phase1 end], scramble, comment,
 *    unix seconds, extension?]
 *
 * with `penalty` one of 0, 2000 (a +2) or -1 (a DNF). Two details that decide
 * whether the times come out right:
 *
 * - index 1 is the RAW time. csTimer shows `penalty + time` for a +2, so the
 *   stored number is the time before the penalty — which is exactly what this
 *   app stores too.
 * - the phase boundaries run BACKWARDS from index 2: the tap that ends the
 *   first phase is written last. They are cumulative from the start of the
 *   solve, so reversing them gives the boundaries in method order.
 *
 * The CSV is a different animal: it holds formatted times (truncated to
 * hundredths, the +2 already added in), no puzzle and no session name. It is
 * read here all the same, because it is what csTimer offers for one session —
 * but the JSON is the lossless one and the screen says so.
 */

import type { Penalty, Puzzle } from '../../db/types';

export interface CsTimerSolve {
  /** Measured time before penalties, whole milliseconds. */
  rawMs: number;
  penalty: Penalty;
  scramble: string;
  note: string | null;
  /** Unix milliseconds, from csTimer's seconds. */
  startedAt: number;
  /**
   * Interior phase boundaries, cumulative from the start and ascending. The
   * last phase is closed by rawMs, exactly as this app's splits are.
   */
  phaseEndsMs: number[];
  /** How many phases the solve was timed in. 1 means it was timed as a whole. */
  phaseCount: number;
}

export interface CsTimerSession {
  /** csTimer's own name, kept as it is. Default sessions are named by number. */
  name: string;
  /** null when csTimer's scramble type has no puzzle in this app. */
  puzzle: Puzzle | null;
  scrambleType: string;
  solves: CsTimerSolve[];
}

export type SkipReason =
  | 'malformed'
  | 'unreadableTime'
  | 'unreadablePenalty'
  | 'unreadableDate';

export interface SkippedRow {
  session: string;
  /** 1-based, the way csTimer numbers solves in a session. */
  index: number;
  reason: SkipReason;
}

export interface CsTimerFile {
  sessions: CsTimerSession[];
  skipped: SkippedRow[];
}

export type CsTimerProblem = 'notJson' | 'notCsTimer' | 'notCsv' | 'empty' | 'unreadable';

export type CsTimerParse =
  | { ok: true; file: CsTimerFile }
  | { ok: false; problem: CsTimerProblem };

/* Planning what an import would do. */

export interface PlannedSession {
  name: string;
  puzzle: Puzzle;
  /** The solves that are not already here. Only these are ever written. */
  solves: CsTimerSolve[];
  /** How many of them carry phase times this app can read. */
  withPhases: number;
  /**
   * Timed by phase, but in some other number of phases than the method has.
   * Those arrive without them, and it is counted so the preview can say so
   * instead of letting the phase times go quietly missing.
   */
  phasesDropped: number;
  /** Already in the database, from an earlier import of the same file. */
  duplicates: number;
}

export interface UnsupportedSession {
  name: string;
  scrambleType: string;
  solves: number;
}

export interface CsTimerPlan {
  /** Only sessions that would actually bring something in. */
  sessions: PlannedSession[];
  unsupported: UnsupportedSession[];
  skipped: SkippedRow[];
  newSolves: number;
  duplicates: number;
  withPhases: number;
  phasesDropped: number;
}

/**
 * What a file would add, against the solves already stored. A solve is the
 * same solve if it was measured at the same moment and took the same time —
 * csTimer's timestamps are whole seconds, so the pair is as good as an id and
 * survives a re-export.
 */
export function csTimerSolveKey(rawMs: number, startedAt: number): string {
  return `${startedAt}:${rawMs}`;
}

export function planCsTimerImport(
  file: CsTimerFile,
  known: ReadonlySet<string>,
  /** How many phases this app's method has; a solve timed in that many keeps them. */
  phaseCount: number,
): CsTimerPlan {
  // Grown as we go, so a file that lists the same solve twice brings it in once.
  const seen = new Set(known);
  const sessions: PlannedSession[] = [];
  const unsupported: UnsupportedSession[] = [];

  for (const session of file.sessions) {
    if (session.puzzle === null) {
      unsupported.push({
        name: session.name,
        scrambleType: session.scrambleType,
        solves: session.solves.length,
      });
      continue;
    }

    const solves: CsTimerSolve[] = [];
    let duplicates = 0;
    let withPhases = 0;
    let phasesDropped = 0;

    for (const solve of session.solves) {
      const key = csTimerSolveKey(solve.rawMs, solve.startedAt);
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      solves.push(solve);
      if (solve.phaseCount === phaseCount) withPhases += 1;
      else if (solve.phaseCount > 1) phasesDropped += 1;
    }

    if (solves.length === 0 && duplicates === 0) continue;
    sessions.push({
      name: session.name,
      puzzle: session.puzzle,
      solves,
      withPhases,
      phasesDropped,
      duplicates,
    });
  }

  return {
    sessions,
    unsupported,
    skipped: file.skipped,
    newSolves: sessions.reduce((sum, session) => sum + session.solves.length, 0),
    duplicates: sessions.reduce((sum, session) => sum + session.duplicates, 0),
    withPhases: sessions.reduce((sum, session) => sum + session.withPhases, 0),
    phasesDropped: sessions.reduce((sum, session) => sum + session.phasesDropped, 0),
  };
}

/* Puzzles. */

/**
 * csTimer names a scramble, not a puzzle: '333', '333oh' and '333bf' are all
 * a 3×3. Matching on the prefix keeps the one-handed and blindfolded sessions
 * instead of throwing them away, and anything this app has no puzzle for
 * (6×6, 7×7, relays) stays null so the preview can say which sessions it
 * cannot take.
 */
const PUZZLE_PREFIXES: readonly (readonly [string, Puzzle])[] = [
  ['333', '333'],
  ['222', '222'],
  ['444', '444'],
  ['555', '555'],
  ['pyr', 'pyram'],
  ['skb', 'skewb'],
  ['sq1', 'sq1'],
  ['sqr', 'sq1'],
  ['clk', 'clock'],
  ['mgm', 'minx'],
  ['mlx', 'minx'],
];

export function puzzleOfScrambleType(scrambleType: string): Puzzle | null {
  for (const [prefix, puzzle] of PUZZLE_PREFIXES) {
    if (scrambleType.startsWith(prefix)) return puzzle;
  }
  return null;
}

/* The JSON export. */

const SESSION_KEY = /^session(\d+)$/;

export function parseCsTimerJson(text: string): CsTimerParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'notJson' };
  }
  if (!isRow(raw)) return { ok: false, problem: 'notCsTimer' };

  const meta = sessionMeta(raw.properties);
  const sessions: CsTimerSession[] = [];
  const skipped: SkippedRow[] = [];
  let sawSession = false;

  for (const [key, value] of Object.entries(raw)) {
    const match = SESSION_KEY.exec(key);
    if (!match || match[1] === undefined) continue;
    if (!Array.isArray(value)) continue;
    sawSession = true;
    if (value.length === 0) continue;

    const index = match[1];
    const entry = meta.get(index);
    const name = entry?.name ?? index;
    const scrambleType = entry?.scrambleType ?? '333';

    const solves: CsTimerSolve[] = [];
    for (const [position, row] of value.entries()) {
      const read = readSolve(row);
      if (read.ok) solves.push(read.solve);
      else skipped.push({ session: name, index: position + 1, reason: read.reason });
    }

    sessions.push({
      name,
      puzzle: puzzleOfScrambleType(scrambleType),
      scrambleType,
      solves,
    });
  }

  if (!sawSession) return { ok: false, problem: 'notCsTimer' };
  if (sessions.length === 0) return { ok: false, problem: 'empty' };

  // csTimer's own order, so the preview lists them as the user knows them.
  sessions.sort((a, b) => order(meta, a.name) - order(meta, b.name));
  return { ok: true, file: { sessions, skipped } };
}

interface SessionMeta {
  name: string;
  scrambleType: string;
  rank: number;
}

/**
 * `properties.sessionData` is JSON inside JSON — a string csTimer parses a
 * second time. Missing or damaged, every session keeps its number for a name
 * and the default puzzle, which is what csTimer itself falls back to.
 */
function sessionMeta(properties: unknown): Map<string, SessionMeta> {
  const meta = new Map<string, SessionMeta>();
  if (!isRow(properties)) return meta;

  let data: unknown = properties.sessionData;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return meta;
    }
  }
  if (!isRow(data)) return meta;

  for (const [key, value] of Object.entries(data)) {
    if (!isRow(value)) continue;
    const opt = isRow(value.opt) ? value.opt : {};
    meta.set(key, {
      // A default session is named by a number, and JSON keeps it a number.
      name: nameOf(value.name) ?? key,
      scrambleType: typeof opt.scrType === 'string' ? opt.scrType : '333',
      rank: typeof value.rank === 'number' ? value.rank : Number(key),
    });
  }
  return meta;
}

function nameOf(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function order(meta: Map<string, SessionMeta>, name: string): number {
  for (const entry of meta.values()) {
    if (entry.name === name) return entry.rank;
  }
  return Number.MAX_SAFE_INTEGER;
}

type SolveRead = { ok: true; solve: CsTimerSolve } | { ok: false; reason: SkipReason };

function readSolve(row: unknown): SolveRead {
  if (!Array.isArray(row) || row.length < 4) return { ok: false, reason: 'malformed' };

  const times = row[0];
  if (!Array.isArray(times) || times.length < 2) return { ok: false, reason: 'malformed' };
  if (!times.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return { ok: false, reason: 'unreadableTime' };
  }

  const penalty = penaltyOf(times[0]);
  if (penalty === null) return { ok: false, reason: 'unreadablePenalty' };

  const rawMs = Math.round(times[1] as number);
  if (rawMs < 0) return { ok: false, reason: 'unreadableTime' };

  const seconds = row[3];
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return { ok: false, reason: 'unreadableDate' };
  }

  // A missing scramble or comment is not worth throwing a time away for.
  const scramble = typeof row[1] === 'string' ? row[1] : '';
  const comment = typeof row[2] === 'string' ? row[2].trim() : '';

  return {
    ok: true,
    solve: {
      rawMs,
      penalty,
      scramble,
      note: comment === '' ? null : comment,
      startedAt: Math.round(seconds * 1000),
      ...phasesOf((times as number[]).slice(1).map((value) => Math.round(value)), rawMs),
    },
  };
}

function penaltyOf(value: unknown): Penalty | null {
  if (value === 0) return 'none';
  if (value === -1) return 'dnf';
  if (value === 2000) return 'plus2';
  // csTimer only writes those three. Anything else is a penalty of a size
  // this app cannot express, and inventing one would be a wrong time.
  return null;
}

/**
 * Phase boundaries, from csTimer's descending list into ours. Rejected as a
 * whole if they do not run forwards or overshoot the solve — a solve with
 * unreadable phases is still a solve, and is kept without them.
 */
function phasesOf(
  descending: number[],
  rawMs: number,
): Pick<CsTimerSolve, 'phaseEndsMs' | 'phaseCount'> {
  const ascending = [...descending].reverse();
  const phaseCount = ascending.length;
  if (phaseCount < 2) return { phaseEndsMs: [], phaseCount: 1 };

  const isOrdered = ascending.every(
    (value, index) => value >= 0 && (index === 0 || value >= (ascending[index - 1] ?? 0)),
  );
  if (!isOrdered || ascending[phaseCount - 1] !== rawMs) {
    return { phaseEndsMs: [], phaseCount: 1 };
  }
  return { phaseEndsMs: ascending.slice(0, -1), phaseCount };
}

/* The CSV export of one session. */

const CSV_HEADER = /^No\.;Time;Comment;Scramble;Date/;

/**
 * csTimer writes one session, semicolon separated, with phase columns holding
 * LENGTHS rather than boundaries. It carries no session name and no puzzle, so
 * both are the caller's to supply.
 */
export function parseCsTimerCsv(text: string, name: string, puzzle: Puzzle): CsTimerParse {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (!CSV_HEADER.test(body)) return { ok: false, problem: 'notCsv' };

  const rows = readCsv(body);
  const header = rows[0];
  if (header === undefined) return { ok: false, problem: 'notCsv' };

  const solves: CsTimerSolve[] = [];
  const skipped: SkippedRow[] = [];

  for (const [position, row] of rows.slice(1).entries()) {
    if (row.length === 1 && (row[0] ?? '') === '') continue;
    const read = readCsvRow(row);
    if (read.ok) solves.push(read.solve);
    else skipped.push({ session: name, index: position + 1, reason: read.reason });
  }

  if (solves.length === 0 && skipped.length === 0) return { ok: false, problem: 'empty' };
  return {
    ok: true,
    file: {
      sessions: [{ name, puzzle, scrambleType: '', solves }],
      skipped,
    },
  };
}

function readCsvRow(row: readonly string[]): SolveRead {
  const [, time, comment, scramble, date, ...phases] = row;
  if (time === undefined || date === undefined) return { ok: false, reason: 'malformed' };

  const result = parseCsvTime(time);
  if (result === null) return { ok: false, reason: 'unreadableTime' };

  const startedAt = parseCsvDate(date);
  if (startedAt === null) return { ok: false, reason: 'unreadableDate' };

  const lengths: number[] = [];
  for (const phase of phases) {
    if (phase.trim() === '') break;
    const ms = parseClock(phase);
    if (ms === null) return { ok: false, reason: 'unreadableTime' };
    lengths.push(ms);
  }

  // Lengths add up to boundaries; the last one is the solve itself and is
  // dropped, the same as in the JSON.
  const ends: number[] = [];
  let running = 0;
  for (const length of lengths) {
    running += length;
    ends.push(running);
  }
  const hasPhases = lengths.length > 1;

  return {
    ok: true,
    solve: {
      rawMs: result.rawMs,
      penalty: result.penalty,
      scramble: scramble ?? '',
      note: comment === undefined || comment.trim() === '' ? null : comment.trim(),
      startedAt,
      phaseEndsMs: hasPhases ? ends.slice(0, -1) : [],
      phaseCount: hasPhases ? lengths.length : 1,
    },
  };
}

const DNF_WITH_TIME = /^DNF\((.+)\)$/;

/**
 * A formatted csTimer time back into a raw one. "12.34+" is a +2 and the two
 * seconds are already in the number, so they come back off — otherwise every
 * penalised solve would be two seconds slower here than in csTimer.
 */
export function parseCsvTime(input: string): { rawMs: number; penalty: Penalty } | null {
  const value = input.trim();
  if (value === '') return null;
  if (value === 'DNF') return { rawMs: 0, penalty: 'dnf' };

  const dnf = DNF_WITH_TIME.exec(value);
  if (dnf?.[1] !== undefined) {
    const ms = parseClock(dnf[1]);
    return ms === null ? null : { rawMs: ms, penalty: 'dnf' };
  }

  if (value.endsWith('+')) {
    const ms = parseClock(value.slice(0, -1));
    if (ms === null || ms < PLUS_TWO_MS) return null;
    return { rawMs: ms - PLUS_TWO_MS, penalty: 'plus2' };
  }

  const ms = parseClock(value);
  return ms === null ? null : { rawMs: ms, penalty: 'none' };
}

const PLUS_TWO_MS = 2000;

/** `s.xx`, `m:ss.xx` or `h:mm:ss.xx`, with two or three decimals. */
const CLOCK = /^(?:(?:(\d+):)?(\d+):)?(\d+)(?:[.,](\d{1,3}))?$/;

function parseClock(input: string): number | null {
  const match = CLOCK.exec(input.trim());
  if (!match) return null;
  const [, hours, minutes, seconds, fraction] = match;
  const whole =
    Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
  const millis = fraction === undefined ? 0 : Number(fraction.padEnd(3, '0'));
  return whole * 1000 + millis;
}

const CSV_DATE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * csTimer writes the date in the device's own time, with no zone in it, so it
 * is read back as local time — the same wall clock the user saw.
 */
function parseCsvDate(input: string): number | null {
  const match = CSV_DATE.exec(input.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const at = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(at.getTime()) ? null : at.getTime();
}

/**
 * Fields separated by semicolons, quoted only when they hold a semicolon or a
 * newline — csTimer's own rule, which is not quite RFC 4180: a lone quote in
 * the middle of a field is data, not a delimiter.
 */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ';') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char ?? '';
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
