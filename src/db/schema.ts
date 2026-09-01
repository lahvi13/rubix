import Dexie, { type Table } from 'dexie';
import { reportError } from '../lib/errors';
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
  }
}

export const db = new RubixDB();

// Opening eagerly turns a blocked or corrupted database into a visible error
// instead of every read and write quietly doing nothing.
db.open().catch((cause: unknown) => {
  reportError(strings.errors.database, cause);
});
