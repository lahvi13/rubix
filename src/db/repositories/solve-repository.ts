import Dexie, { type Collection } from 'dexie';
import { db } from '../schema';
import { SPLITS_SCHEMA_VERSION, type Penalty, type Puzzle, type Solve, type Split } from '../types';
import { finalMs } from '../../domain/solve/final-time';
import { clampSplitsToRaw, normaliseSplits } from '../../domain/solve/splits';
import { now } from '../../lib/clock';
import { createId } from '../../lib/uuid';

/** Everything a caller must supply; the repository owns ids and timestamps. */
export interface NewSolve {
  sessionId: string;
  puzzle: Solve['puzzle'];
  mode: Solve['mode'];
  caseId?: string | null;
  scramble: string;
  /** Omitted for the app's own scramble, which is nearly every solve. */
  scrambleSource?: Solve['scrambleSource'];
  rawMs: number;
  penalty: Penalty;
  penaltySource: Solve['penaltySource'];
  inspectionMs: number | null;
  startedAt: number;
  /** Phase boundaries, cumulative from the start. Omitted for a solve timed as a whole. */
  splits?: Split[];
  /** Method phase keys, in order — splits outside them cannot be read back and are dropped. */
  phaseKeys?: readonly string[];
}

/** Fields the user is allowed to change after the fact. */
export interface SolvePatch {
  penalty?: Penalty;
  rawMs?: number;
  note?: string | null;
  starred?: 0 | 1;
  tagIds?: string[];
  splits?: Split[];
  /** Required alongside splits, for the same reason as in NewSolve. */
  phaseKeys?: readonly string[];
}

export interface SolveFilters {
  penalty?: Penalty;
  /** The reader's own mark on a solve. */
  starred?: boolean;
  /**
   * Only the session's records. Not applied here: what a record is depends on
   * every solve of the session, which this query is in the middle of reading.
   */
  record?: boolean;
  /**
   * One day of practice, as a local date key. Not applied here either: which
   * day a timestamp falls on is a question about the reader's timezone.
   */
  day?: string;
  tagId?: string;
}

export async function addSolve(input: NewSolve): Promise<Solve> {
  const timestamp = now();
  const solve: Solve = {
    id: createId(),
    sessionId: input.sessionId,
    puzzle: input.puzzle,
    mode: input.mode,
    caseId: input.caseId ?? null,
    scramble: input.scramble,
    scrambleSource: input.scrambleSource ?? 'generated',
    rawMs: Math.round(input.rawMs),
    penalty: input.penalty,
    penaltySource: input.penaltySource,
    inspectionMs: input.inspectionMs === null ? null : Math.round(input.inspectionMs),
    startedAt: input.startedAt,
    splits: normaliseSplits(input.splits ?? [], input.phaseKeys ?? [], Math.round(input.rawMs)),
    splitsSchemaVersion: SPLITS_SCHEMA_VERSION,
    tagIds: [],
    note: null,
    starred: 0,
    editedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.solves.add(solve);
  return solve;
}

export async function getSolve(id: string): Promise<Solve | undefined> {
  return db.solves.get(id);
}

export async function listRecentSolves(sessionId: string, limit: number): Promise<Solve[]> {
  return listSolves(sessionId, limit);
}

/**
 * Newest first. Filtering happens over the session's index cursor rather than
 * over the whole table, so an archived session with thousands of solves does
 * not get read just to show ten rows.
 */
export async function listSolves(
  sessionId: string,
  limit: number,
  filters: SolveFilters = {},
): Promise<Solve[]> {
  return matchingSolves(sessionId, filters).limit(limit).toArray();
}

/**
 * Every solve the filters match, newest first. The history's list is paged,
 * but "the best of these" cannot be: a best that improves as more rows are
 * loaded is not a best, it is a reading of how far somebody has scrolled.
 */
export async function listMatchingSolves(
  sessionId: string,
  filters: SolveFilters = {},
): Promise<Solve[]> {
  return matchingSolves(sessionId, filters).toArray();
}

function matchingSolves(sessionId: string, filters: SolveFilters): Collection<Solve, string> {
  let collection = db.solves
    .where('[sessionId+createdAt]')
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .reverse();

  if (filters.penalty !== undefined) {
    const penalty = filters.penalty;
    collection = collection.filter((solve) => solve.penalty === penalty);
  }
  if (filters.starred) {
    collection = collection.filter((solve) => solve.starred === 1);
  }
  if (filters.tagId !== undefined) {
    const tagId = filters.tagId;
    collection = collection.filter((solve) => solve.tagIds.includes(tagId));
  }

  return collection;
}

/** Oldest first — the order every rolling statistic is defined over. */
export async function listSolvesChronological(sessionId: string): Promise<Solve[]> {
  return db.solves
    .where('[sessionId+createdAt]')
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .toArray();
}

/**
 * Every freestyle solve of a puzzle from the sessions still in use, oldest
 * first. An archived session is one put away, and the numbers over "all my
 * sessions" should not keep counting it. The personal best still does — see
 * deleteSession for why a best must not move when the list is tidied.
 */
export async function listPuzzleSolvesChronological(puzzle: Puzzle): Promise<Solve[]> {
  const archived = new Set(
    await db.sessions.where('[mode+isArchived]').equals(['freestyle', 1]).primaryKeys(),
  );
  const solves = await db.solves
    .where('[mode+puzzle]')
    .equals(['freestyle', puzzle])
    .sortBy('createdAt');
  return archived.size === 0 ? solves : solves.filter((solve) => !archived.has(solve.sessionId));
}

/**
 * The best single a puzzle has ever seen, across all freestyle sessions, and
 * the solve it belongs to: the fastest clean solve or the fastest +2, whichever
 * ends up faster once the penalty is in. The index is ordered by time within
 * each penalty, so that is two rows read — DNFs and drills are never touched.
 * On a tie the clean solve holds it.
 *
 * The solve itself, not only the time: the history marks the row it is on and
 * the stats offer to open it, and both need to know which one it is. It may
 * well be in another session than the one being read.
 */
export async function getGlobalPbSolve(puzzle: Puzzle): Promise<Solve | null> {
  const fastest = (penalty: Penalty) =>
    db.solves
      .where('[puzzle+mode+penalty+rawMs]')
      .between([puzzle, 'freestyle', penalty, Dexie.minKey], [puzzle, 'freestyle', penalty, Dexie.maxKey])
      .first();
  const clean = await fastest('none');
  const plusTwo = await fastest('plus2');
  const cleanMs = clean === undefined ? null : finalMs(clean);
  const plusTwoMs = plusTwo === undefined ? null : finalMs(plusTwo);
  if (plusTwo !== undefined && plusTwoMs !== null && (cleanMs === null || plusTwoMs < cleanMs)) {
    return plusTwo;
  }
  return clean ?? null;
}

export async function getGlobalPbSingle(puzzle: Puzzle): Promise<number | null> {
  const solve = await getGlobalPbSolve(puzzle);
  return solve === null ? null : finalMs(solve);
}

/** Every solve on the device, in every session — counted, not read. */
export async function countAllSolves(): Promise<number> {
  return db.solves.count();
}

export async function countSolves(sessionId: string): Promise<number> {
  return db.solves.where('sessionId').equals(sessionId).count();
}

/**
 * Solves a backup taken at `timestamp` would not have as they are now: new,
 * edited, moved or imported since. Counted on the index, not read — the data
 * screen asks again after every write, and the answer is a number.
 */
export async function countSolvesChangedSince(timestamp: number): Promise<number> {
  return db.solves.where('updatedAt').above(timestamp).count();
}

/**
 * How many solves carry a tag, across every session. Asked before a tag is
 * deleted: deleting one strips it from all of them, and the number is the
 * only warning of how much that touches.
 */
export async function countSolvesWithTag(tagId: string): Promise<number> {
  return db.solves.where('tagIds').equals(tagId).count();
}

/** Manual penalty change from the UI. Always marks the solve as edited. */
export async function setPenalty(id: string, penalty: Penalty): Promise<void> {
  await updateSolve(id, { penalty });
}

/**
 * Any user edit goes through here so editedAt is impossible to forget. The
 * patch is a whitelist: scramble, timestamps and ids are never rewritten.
 */
export async function updateSolve(id: string, patch: SolvePatch): Promise<void> {
  const timestamp = now();
  const changes: Partial<Solve> = { editedAt: timestamp, updatedAt: timestamp };

  if (patch.penalty !== undefined) {
    changes.penalty = patch.penalty;
    changes.penaltySource = 'manual';
  }
  if (patch.rawMs !== undefined) changes.rawMs = Math.round(patch.rawMs);

  // Splits are bounded by the raw time, so anything touching either of them
  // has to be checked against the raw time this patch leaves behind.
  if (patch.splits !== undefined || patch.rawMs !== undefined) {
    const existing = await db.solves.get(id);
    const rawMs = changes.rawMs ?? existing?.rawMs ?? 0;
    changes.splits =
      patch.splits === undefined
        ? clampSplitsToRaw(existing?.splits ?? [], rawMs)
        : normaliseSplits(patch.splits, patch.phaseKeys ?? [], rawMs);
  }
  if (patch.note !== undefined) changes.note = patch.note;
  if (patch.starred !== undefined) changes.starred = patch.starred;
  if (patch.tagIds !== undefined) changes.tagIds = patch.tagIds;

  await db.solves.update(id, changes);
}

/** Deleting always leaves a tombstone, otherwise a later import resurrects the row. */
export async function deleteSolve(id: string): Promise<Solve[]> {
  return deleteSolves([id]);
}

/**
 * Returns the rows that were removed, so the caller can offer to put them
 * back. Read inside the same transaction as the delete: a solve edited between
 * the read and the delete would otherwise be restored as its older self.
 */
export async function deleteSolves(ids: string[]): Promise<Solve[]> {
  if (ids.length === 0) return [];
  const deletedAt = now();

  return db.transaction('rw', db.solves, db.tombstones, async () => {
    const removed = (await db.solves.bulkGet(ids)).filter((solve) => solve !== undefined);
    await db.solves.bulkDelete(ids);
    await db.tombstones.bulkPut(
      ids.map((id) => ({ id, table: 'solves', deletedAt })),
    );
    return removed;
  });
}

/**
 * Moves solves into another session, and reports them as they were so the move
 * can be taken back. Solves left in the wrong session are a run of them rather
 * than one, and a run put back one at a time is not an undo.
 *
 * `editedAt` stays untouched: it says the solve's own numbers were adjusted,
 * and which session a solve is filed under is not one of them.
 */
export async function moveSolves(ids: readonly string[], sessionId: string): Promise<Solve[]> {
  if (ids.length === 0) return [];
  const timestamp = now();

  return db.transaction('rw', db.solves, async () => {
    const found = (await db.solves.bulkGet([...ids])).filter((solve) => solve !== undefined);
    // A solve already in the destination is not a move, and reporting it as
    // one would offer an undo that puts it where it already is.
    const moving = found.filter((solve) => solve.sessionId !== sessionId);
    if (moving.length === 0) return [];

    await db.solves.bulkPut(
      moving.map((solve) => ({ ...solve, sessionId, updatedAt: timestamp })),
    );
    return moving;
  });
}

/**
 * Puts deleted solves back, tombstones included — a row that returns while its
 * tombstone stays behind is a row the next import deletes again.
 *
 * The rows go back exactly as they were, `updatedAt` and all: an undo is the
 * delete not having happened, not an edit.
 */
export async function restoreSolves(solves: readonly Solve[]): Promise<void> {
  if (solves.length === 0) return;
  const ids = solves.map((solve) => solve.id);

  await db.transaction('rw', db.solves, db.tombstones, async () => {
    await db.solves.bulkPut([...solves]);
    // Only our own graves: a tombstone id is the entity id alone, and another
    // table's row could in principle carry the same one.
    const graves = await db.tombstones.bulkGet(ids);
    await db.tombstones.bulkDelete(
      graves.filter((grave) => grave?.table === 'solves').map((grave) => grave?.id ?? ''),
    );
  });
}

