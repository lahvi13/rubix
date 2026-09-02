/**
 * Entity types — the single source of truth for anything persisted.
 * UI must not define its own copies. See SPEC.md section 4.
 */

export type Puzzle = '333' | '222' | '444' | '555' | 'pyram' | 'skewb' | 'sq1' | 'clock' | 'minx';
export type SolveMode = 'freestyle' | 'drill';
export type Penalty = 'none' | 'plus2' | 'dnf';
export type PenaltySource = 'auto' | 'manual';
export type SplitSource = 'mic' | 'smartcube' | 'manual';

/** IndexedDB cannot index booleans, so every indexed flag is stored as 0 | 1. */
export type Flag = 0 | 1;

/** Current shape of Solve.splits. Bump when the split model changes. */
export const SPLITS_SCHEMA_VERSION = 1;

export interface Split {
  /** References Method.phases[].key. Deliberately a free string, not an enum. */
  phase: string;
  /** Cumulative offset from the start of the solve. */
  atMs: number;
  source: SplitSource;
  /** Only set for automatic detection. */
  confidence?: number;
}

export interface Solve {
  id: string;
  sessionId: string;
  /** Denormalised from the session so global PB can be indexed. */
  puzzle: Puzzle;
  mode: SolveMode;
  /** Set only for mode === 'drill'. */
  caseId: string | null;

  scramble: string;
  /** Measured time before penalties, integer milliseconds. */
  rawMs: number;
  penalty: Penalty;
  penaltySource: PenaltySource;

  /** null when inspection was disabled. */
  inspectionMs: number | null;
  startedAt: number;

  splits: Split[];
  splitsSchemaVersion: number;

  tagIds: string[];
  note: string | null;
  starred: Flag;

  /** Non-null once the user changed anything after the solve was stored. */
  editedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  name: string;
  puzzle: Puzzle;
  mode: SolveMode;
  methodId: string;
  isArchived: Flag;
  /** At most one active session per (puzzle, mode). */
  isActive: Flag;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface MethodPhase {
  key: string;
  label: string;
  order: number;
}

export interface Method {
  id: string;
  name: string;
  puzzle: Puzzle;
  phases: MethodPhase[];
  createdAt: number;
  updatedAt: number;
}

export interface AlgSet {
  id: string;
  name: string;
  puzzle: Puzzle;
  methodId: string;
  packVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface AlgCase {
  id: string;
  setId: string;
  name: string;
  group: string | null;
  setupAlg: string;
  order: number;
  isCustom: Flag;
  /** null for user-created cases. */
  packVersion: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Algorithm {
  id: string;
  caseId: string;
  moves: string;
  /** Exactly one active algorithm per case. */
  isActive: Flag;
  source: 'pack' | 'user';
  packVersion: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * A named sequence the trainer highlights inside an algorithm — the sexy move
 * and friends. Built-in ones ship with the app; a user can add their own.
 */
export interface Trigger {
  id: string;
  name: string;
  moves: string;
  source: 'pack' | 'user';
  /** Highlight colour; absent means the app picks one. */
  colour?: string;
  /** 0 keeps a trigger without highlighting it. */
  isEnabled: Flag;
  createdAt: number;
  updatedAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
  /** 1 => excluded from export, belongs to this device only. */
  deviceLocal: Flag;
  updatedAt: number;
}

export interface Tombstone {
  /** Id of the deleted entity. */
  id: string;
  table: string;
  deletedAt: number;
}
