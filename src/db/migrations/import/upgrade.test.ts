import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION } from '../../../domain/transfer/types';
import { upgradeImportFormat } from './upgrade';

describe('upgradeImportFormat', () => {
  it('leaves a current file untouched', () => {
    const file = { format: EXPORT_FORMAT, formatVersion: EXPORT_FORMAT_VERSION, data: {} };

    expect(upgradeImportFormat(file)).toEqual(file);
  });

  it('passes anything it cannot recognise straight to the validator', () => {
    expect(upgradeImportFormat('nope')).toBe('nope');
    expect(upgradeImportFormat(null)).toBeNull();
  });

  it('does not mutate the parsed file', () => {
    const file = { format: EXPORT_FORMAT, formatVersion: EXPORT_FORMAT_VERSION };
    const upgraded = upgradeImportFormat(file);

    expect(upgraded).not.toBe(file);
  });

  describe('from format 1', () => {
    const v1 = (data: Record<string, unknown>) => ({
      format: EXPORT_FORMAT,
      formatVersion: 1,
      data,
    });

    it('says every solve before it was on a generated scramble', () => {
      const upgraded = upgradeImportFormat(v1({ solves: [{ id: 'a' }, { id: 'b' }] }));

      expect(upgraded).toMatchObject({
        formatVersion: EXPORT_FORMAT_VERSION,
        data: { solves: [{ id: 'a', scrambleSource: 'generated' }, { id: 'b', scrambleSource: 'generated' }] },
      });
    });

    it('gives cases from before their own names the null a case without one has', () => {
      const upgraded = upgradeImportFormat(v1({ algCases: [{ id: 'pll-t' }] }));

      expect(upgraded).toMatchObject({ data: { algCases: [{ id: 'pll-t', label: null }] } });
    });

    it('keeps a name the reader gave a case', () => {
      const upgraded = upgradeImportFormat(v1({ algCases: [{ id: 'pll-t', label: 'Tee' }] }));

      expect(upgraded).toMatchObject({ data: { algCases: [{ id: 'pll-t', label: 'Tee' }] } });
    });

    it('leaves rows it cannot read for the validator to refuse', () => {
      const upgraded = upgradeImportFormat(v1({ solves: 'nope', algCases: [7] }));

      expect(upgraded).toMatchObject({ data: { solves: 'nope', algCases: [7] } });
    });
  });

  it('starts every case of a format 2 file as new', () => {
    const upgraded = upgradeImportFormat({
      format: EXPORT_FORMAT,
      formatVersion: 2,
      data: { algCases: [{ id: 'pll-t', label: null }, { id: 'pll-y', progress: 'known' }] },
    });

    expect(upgraded).toMatchObject({
      formatVersion: EXPORT_FORMAT_VERSION,
      data: { algCases: [{ id: 'pll-t', progress: 'new' }, { id: 'pll-y', progress: 'known' }] },
    });
  });

  it('reads a format 3 file as it is', () => {
    const data = { solves: [{ id: 's1', scrambleSource: 'history' }] };
    const upgraded = upgradeImportFormat({ format: EXPORT_FORMAT, formatVersion: 3, data });

    expect(upgraded).toEqual({ format: EXPORT_FORMAT, formatVersion: EXPORT_FORMAT_VERSION, data });
  });
});
