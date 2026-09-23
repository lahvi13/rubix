/**
 * The export file format — see SPEC.md section 4.7. This is the only shape
 * that ever leaves or enters the app, so it is described here once and both
 * the writer and the reader work from it.
 */

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
} from '../../db/types';

/** A file without this marker is not ours and is never read. */
export const EXPORT_FORMAT = 'rubix-export';

/** Bump only together with a migration in db/migrations/import. */
export const EXPORT_FORMAT_VERSION = 2;

/**
 * Table order is part of the format: the exporter writes tables and rows in a
 * fixed order, so exporting the same data twice yields byte-identical files
 * and a diff between two backups shows real changes only.
 */
export const TRANSFER_TABLES = [
  'sessions',
  'solves',
  'tags',
  'methods',
  'algSets',
  'algCases',
  'algorithms',
  'triggers',
  'settings',
  'tombstones',
] as const;

export type TransferTable = (typeof TRANSFER_TABLES)[number];

export interface ExportData {
  sessions: Session[];
  solves: Solve[];
  tags: Tag[];
  methods: Method[];
  algSets: AlgSet[];
  algCases: AlgCase[];
  algorithms: Algorithm[];
  triggers: Trigger[];
  settings: Setting[];
  tombstones: Tombstone[];
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  formatVersion: number;
  exportedAt: number;
  appVersion: string;
  dbVersion: number;
  data: ExportData;
}

export function emptyExportData(): ExportData {
  return {
    sessions: [],
    solves: [],
    tags: [],
    methods: [],
    algSets: [],
    algCases: [],
    algorithms: [],
    triggers: [],
    settings: [],
    tombstones: [],
  };
}
