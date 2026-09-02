/**
 * Migrations for older export files. The reader only ever understands the
 * current format, so every file passes through here first and comes out at
 * EXPORT_FORMAT_VERSION.
 *
 * There is nothing to migrate yet — version 1 is the only format that has ever
 * shipped — but the seam exists so a future version 2 never has to teach the
 * validator about shapes that no longer exist. Each upgrade takes the file
 * with `formatVersion: n` and returns it with `n + 1`; the chain runs until it
 * runs out of upgrades.
 */

import { EXPORT_FORMAT_VERSION } from '../../../domain/transfer/types';

type RawFile = Record<string, unknown>;

const UPGRADES: Record<number, (file: RawFile) => RawFile> = {};

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
