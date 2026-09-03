import Dexie, { type Table } from 'dexie';
import { installWriteWatchdog, logQuietly, reportError } from '../lib/errors';
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
  reopen: ensureDatabaseOpen,
  recover: reconnectDatabase,
});

// An upgrade waiting on another window would otherwise hang every query in
// this one, silently.
db.on('blocked', () => {
  reportError(strings.errors.database, new Error(strings.errors.databaseBlocked));
});

// A connection can go away for reasons the user need not hear about — the
// phone freezing the app in the background is one. It is logged either way,
// because it is the first thing worth knowing afterwards, but it only becomes
// a banner if the way back fails.
db.on('close', () => {
  logQuietly(strings.errors.database, new Error(strings.errors.databaseClosed));
  void ensureDatabaseOpen();
});

void ensureDatabaseOpen();

// Coming back to the foreground is exactly when a phone has taken the
// connection away, so that is when it is worth checking.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void ensureDatabaseOpen();
});
