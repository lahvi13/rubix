import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION, type TransferTable } from './types';
import { parseExportFile } from './validate';

function file(data: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: 1_756_684_800_000,
    appVersion: '0.4.0',
    dbVersion: 1,
    data,
  };
}

const solveRow = {
  id: 'solve-1',
  sessionId: 'session-1',
  puzzle: '333',
  mode: 'freestyle',
  caseId: null,
  scramble: "R U R' U'",
  rawMs: 12_340,
  penalty: 'none',
  penaltySource: 'auto',
  inspectionMs: null,
  startedAt: 1_756_684_000_000,
  splits: [],
  splitsSchemaVersion: 1,
  tagIds: [],
  note: null,
  starred: 0,
  editedAt: null,
  createdAt: 1_756_684_000_000,
  updatedAt: 1_756_684_000_000,
};

const sessionRow = {
  id: 'session-1',
  name: 'Default',
  puzzle: '333',
  mode: 'freestyle',
  methodId: 'cfop',
  isArchived: 0,
  isActive: 1,
  createdAt: 1,
  updatedAt: 1,
};

describe('parseExportFile', () => {
  it('accepts a complete file', () => {
    const result = parseExportFile(file({ sessions: [sessionRow], solves: [solveRow] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.data.solves).toHaveLength(1);
    expect(result.file.data.sessions[0]?.name).toBe('Default');
  });

  it('treats a missing table as an empty one', () => {
    const result = parseExportFile(file({ solves: [solveRow] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.data.tags).toEqual([]);
    expect(result.file.data.tombstones).toEqual([]);
  });

  it('keeps fields it does not know about, so an older build does not strip them', () => {
    const result = parseExportFile(file({ solves: [{ ...solveRow, futureField: 'keep me' }] }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.data.solves[0]).toHaveProperty('futureField', 'keep me');
  });

  it.each<[string, unknown, string]>([
    ['a string', 'nope', 'malformed'],
    ['null', null, 'malformed'],
    ['an array', [], 'malformed'],
    ['another app', { ...file(), format: 'csTimer' }, 'unknownFormat'],
    ['no data object', { ...file(), data: 'nope' }, 'malformed'],
    ['no exportedAt', { ...file(), exportedAt: 'yesterday' }, 'malformed'],
    ['a fractional formatVersion', { ...file(), formatVersion: 1.5 }, 'malformed'],
  ])('rejects %s', (_name, input, code) => {
    const result = parseExportFile(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem.code).toBe(code);
  });

  it('refuses a file from a newer format, rather than guessing', () => {
    const result = parseExportFile({ ...file(), formatVersion: EXPORT_FORMAT_VERSION + 1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toEqual({
      code: 'unsupportedVersion',
      formatVersion: EXPORT_FORMAT_VERSION + 1,
    });
  });

  it.each<[string, Record<string, unknown>, TransferTable, number]>([
    ['a fractional time', { solves: [solveRow, { ...solveRow, rawMs: 12.5 }] }, 'solves', 1],
    ['a boolean flag', { solves: [{ ...solveRow, starred: true }] }, 'solves', 0],
    ['an unknown penalty', { solves: [{ ...solveRow, penalty: 'plus4' }] }, 'solves', 0],
    ['an unknown puzzle', { solves: [{ ...solveRow, puzzle: '666' }] }, 'solves', 0],
    ['a missing field', { solves: [{ ...solveRow, scramble: undefined }] }, 'solves', 0],
    [
      'a split with an unknown source',
      { solves: [{ ...solveRow, splits: [{ phase: 'cross', atMs: 900, source: 'guess' }] }] },
      'solves',
      0,
    ],
    ['a setting without a value', { settings: [{ key: 'ui.theme', deviceLocal: 0, updatedAt: 1 }] }, 'settings', 0],
    ['a table that is not an array', { tags: 'nope' }, 'tags', 0],
  ])('rejects %s and says where it is', (_name, data, table, index) => {
    const result = parseExportFile(file(data));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toEqual({ code: 'invalidRow', table, index });
  });
});
