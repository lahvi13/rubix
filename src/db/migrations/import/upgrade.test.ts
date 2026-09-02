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
});
