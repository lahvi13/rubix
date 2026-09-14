import Dexie, { type Table } from 'dexie';
import { installWriteWatchdog, reportError } from '../lib/errors';
import { now } from '../lib/clock';
import { strings } from '../lib/strings';
import type {
  AlgCase,
  AlgSet,
  Algorithm,
  Method,
  Session,
  Setting,
  Solve,
  Tag,
  Tombstone,
  Trigger,
} from './types';

/**
 * Treat this as an identifier, not a brand. Renaming it orphans every user's
 * data, because IndexedDB databases are looked up by name.
 */
export const DB_NAME = 'rubix';

/**
 * Schema v1 declares every table from SPEC.md, including the ones no feature
 * reads yet. Empty object stores cost nothing; a later version bump does.
 */
export class RubixDB extends Dexie {
  solves!: Table<Solve, string>;
  sessions!: Table<Session, string>;
  tags!: Table<Tag, string>;
  methods!: Table<Method, string>;
  algSets!: Table<AlgSet, string>;
  algCases!: Table<AlgCase, string>;
  algorithms!: Table<Algorithm, string>;
  triggers!: Table<Trigger, string>;
  settings!: Table<Setting, string>;
  tombstones!: Table<Tombstone, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      solves:
        'id, sessionId, caseId, createdAt, updatedAt, starred, *tagIds, ' +
        '[sessionId+createdAt], [caseId+createdAt], [mode+puzzle], [puzzle+mode+penalty]',
      sessions: 'id, puzzle, mode, updatedAt, [puzzle+mode+isActive], [mode+isArchived]',
      tags: 'id, &name, updatedAt',
      methods: 'id, puzzle',
      algSets: 'id, puzzle, methodId',
      algCases: 'id, setId, isCustom, updatedAt, [setId+order]',
      algorithms: 'id, caseId, updatedAt, [caseId+isActive]',
      settings: 'key, deviceLocal, updatedAt',
      tombstones: 'id, deletedAt, [table+deletedAt]',
    });

    // v2 adds the trainer's triggers. Only the new table is listed; Dexie
    // carries the rest of v1 over untouched, and the old version is never
    // edited.
    this.version(2).stores({
      triggers: 'id, updatedAt, isEnabled',
    });

    // v3 gives a case the name its owner calls it by. No index changes — the
    // field is only ever read whole — but the rows still have to be filled in:
    // a missing property and an explicit null read the same in TypeScript and
    // differently in an export, and the export is what has to round-trip.
    this.version(3).upgrade((tx) =>
      tx
        .table<AlgCase>('algCases')
        .toCollection()
        .modify((algCase) => {
          algCase.label = null;
        }),
    );

    // v4 orders each penalty's solves by time, so the personal best is the
    // first row of two ranges instead of a walk over every solve ever timed.
    // The walk was not only slow: a live query keeps track of every key it
    // reads, and with thousands of solves that bookkeeping, repeated after
    // each one the timer saved, was most of the stall. Dexie fills the index
    // for the rows already there; nothing else about a solve changes.
    this.version(4).stores({
      solves:
        'id, sessionId, caseId, createdAt, updatedAt, starred, *tagIds, ' +
        '[sessionId+createdAt], [caseId+createdAt], [mode+puzzle], [puzzle+mode+penalty], ' +
        '[puzzle+mode+penalty+rawMs]',
    });
  }
}

export const db = new RubixDB();

/**
 * How long an open may take before it counts as stuck. An open that never
 * settles is the worst failure this app has: Dexie queues every read and write
 * behind it, so the screens keep their last contents, taps change nothing, and
 * nothing is thrown for anyone to report. Seen on Android, where a backgrounded
 * PWA has its IndexedDB connection force-closed and the reopen can then be
 * blocked by the frozen page that still holds it.
 */
const OPEN_TIMEOUT_MS = 6000;

/**
 * Goes up when the connection had to be *repaired* — not when the phone merely
 * took it away and it came back. A repair throws away whatever was stuck,
 * which can include the queries a screen is waiting on, so those screens have
 * to ask again. A routine reopen leaves them alone: on a phone the connection
 * is lost every few minutes, and rebuilding fifty cube diagrams each time is
 * its own kind of broken.
 */
let generation = 0;
const reconnectListeners = new Set<() => void>();

export function databaseGeneration(): number {
  return generation;
}

export function onDatabaseReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => reconnectListeners.delete(listener);
}

/**
 * Opens the database, and turns "it never answered" into an error somebody can
 * see. Safe to call at any time: an already open database resolves at once.
 */
export async function ensureDatabaseOpen(): Promise<boolean> {
  if (db.isOpen()) return true;

  const verdict = await Promise.race([
    db.open().then(() => 'open' as const),
    new Promise<'stuck'>((resolve) => setTimeout(() => resolve('stuck'), OPEN_TIMEOUT_MS)),
  ]).catch((cause: unknown) => cause);

  if (verdict === 'open') return true;
  if (verdict === 'stuck') {
    reportError(strings.errors.database, new Error(strings.errors.databaseStuck));
    return false;
  }
  reportError(strings.errors.database, verdict);
  return false;
}

/**
 * Closes and opens again. The way out of a connection that Chrome closed under
 * the app, without asking the user to work out that "reload the page in a
 * browser" is what an installed app needs.
 */
export function isDatabaseOpen(): boolean {
  return db.isOpen();
}

export async function reconnectDatabase(): Promise<boolean> {
  db.close();
  const isOpen = await ensureDatabaseOpen();
  if (isOpen) {
    generation += 1;
    for (const listener of reconnectListeners) listener();
  }
  return isOpen;
}

/**
 * The read the watchdog probes with. A readwrite transaction that never
 * commits blocks reads of the same table too, so a settings read that does not
 * answer means the queue is stuck rather than merely busy.
 */
installWriteWatchdog({
  probe: () => db.settings.get('probe.alive'),
  survey: surveyDatabase,
  reopen: ensureDatabaseOpen,
  recover: reconnectDatabase,
});

// An upgrade waiting on another window would otherwise hang every query in
// this one, silently.
db.on('blocked', () => {
  reportError(strings.errors.database, new Error(strings.errors.databaseBlocked));
});

// A connection can go away for reasons the user need not hear about — Android
// takes it from a backgrounded app every few minutes. Not logged: the log keeps
// only a handful of entries, and a routine close pushed the real failures out
// of it. Nothing is lost by that — a reopen that fails reports itself, and a
// write the close interrupted is logged by the watchdog that retries it.
db.on('close', () => {
  void ensureDatabaseOpen();
});

void ensureDatabaseOpen();

// Coming back to the foreground is exactly when a phone has taken the
// connection away, so that is when it is worth checking.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void ensureDatabaseOpen();
});

/**
 * A hidden copy of this app must not hold the database.
 *
 * Two copies are normal — the installed app and a browser tab — and the phone
 * freezes whichever is in the background. A frozen page keeps its connection
 * and any transaction inside it, and that blocks the copy the user is actually
 * looking at: writes queue for ever, and no amount of reloading *that* copy
 * helps, because the block is in the other one. So this copy lets go the
 * moment it is put away, and takes the database back when it returns.
 */
document.addEventListener('freeze', () => db.close());
window.addEventListener('pagehide', () => db.close());
document.addEventListener('resume', () => void ensureDatabaseOpen());
window.addEventListener('pageshow', () => void ensureDatabaseOpen());

/**
 * What is actually stuck, table by table, and whether a brand new connection
 * fares any better. Run when a write times out: "the database did not answer"
 * is where the diagnosis used to stop, and this is the line that carries it
 * further — a fresh connection that also hangs means the block is held by
 * another copy of the app, which is a different problem from a connection of
 * ours gone bad.
 */
export async function surveyDatabase(): Promise<string> {
  const budget = 2500;
  const timed = async (label: string, work: () => Promise<unknown>): Promise<string> => {
    const started = performance.now();
    const outcome = await Promise.race([
      work().then(
        () => 'ok',
        (cause: unknown) => (cause instanceof Error ? cause.name : 'failed'),
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve('STUCK'), budget)),
    ]);
    const took = Math.round(performance.now() - started);
    return `${label}=${outcome === 'ok' ? `${took}ms` : outcome}`;
  };

  const parts = await Promise.all([
    timed('settings', () => db.settings.get('probe.alive')),
    timed('algorithms', () => db.algorithms.count()),
    timed('solves', () => db.solves.count()),
    timed('write', () =>
      db.settings.put({ key: 'probe.alive', value: 1, deviceLocal: 1, updatedAt: now() }),
    ),
    timed('newConnection', openFreshConnection),
  ]);

  return parts.join(' ');
}

/**
 * A connection opened straight through the browser, bypassing Dexie. If this
 * one hangs as well, nothing about our connection is to blame.
 */
async function openFreshConnection(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error ?? new Error('open failed'));
    request.onblocked = () => reject(new Error('blocked'));
  });
}
