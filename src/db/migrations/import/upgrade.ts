/**
 * Migrations for older export files. The reader only ever understands the
 * current format, so every file passes through here first and comes out at
 * EXPORT_FORMAT_VERSION.
 *
 * Each upgrade takes the file with `formatVersion: n` and returns it with
 * `n + 1`; the chain runs until it runs out of upgrades, so the validator only
 * ever learns the shape that exists today.
 */

import { EXPORT_FORMAT_VERSION } from '../../../domain/transfer/types';

type RawFile = Record<string, unknown>;

const UPGRADES: Record<number, (file: RawFile) => RawFile> = {
  1: fillMissingFields,
  2: fillCaseProgress,
  3: (file) => file,
};

/**
 * 1 -> 2: fields the database gained while the format stayed at 1.
 *
 * A case's own name (DB v3) was added without touching the format, so a
 * backup taken before it has cases with no `label` — and the validator, which
 * wants one on every row, refused the whole file. Where a solve's scramble
 * came from (DB v5) is the change that bumped the format, and every solve
 * before it was on a scramble the app drew itself.
 *
 * Filled in only where missing: a file from between the two has labels
 * already, and they are the reader's own.
 */
function fillMissingFields(file: RawFile): RawFile {
  const data = file.data;
  if (!isRecord(data)) return file;

  return {
    ...file,
    data: {
      ...data,
      algCases: fillEach(data.algCases, 'label', null),
      solves: fillEach(data.solves, 'scrambleSource', 'generated'),
    },
  };
}

/**
 * 2 -> 3: how far the reader is with each case (DB v6). A file from before
 * knows nothing of it, so every case starts where a fresh device's would.
 */
function fillCaseProgress(file: RawFile): RawFile {
  const data = file.data;
  if (!isRecord(data)) return file;
  return { ...file, data: { ...data, algCases: fillEach(data.algCases, 'progress', 'new') } };
}

/*
 * 3 -> 4 changes nothing in the file: it is the first format in which a solve
 * can be on a shared scramble. The number moved so that an app from before
 * refuses such a file as one from a newer version, which it is, rather than
 * as a damaged one.
 */

function fillEach(rows: unknown, field: string, value: unknown): unknown {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row: unknown) =>
    isRecord(row) && !(field in row) ? { ...row, [field]: value } : row,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function upgradeImportFormat(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input;

  let file: RawFile = { ...input };
  let version = file.formatVersion;

  while (typeof version === 'number' && version < EXPORT_FORMAT_VERSION) {
    const upgrade = UPGRADES[version];
    if (upgrade === undefined) return file;

    file = upgrade(file);
    file.formatVersion = version + 1;
    version = file.formatVersion;
  }

  return file;
}
