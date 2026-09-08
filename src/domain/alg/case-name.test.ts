import { describe, expect, it } from 'vitest';
import { caseAlias, caseTitle, type NamedCase } from './case-name';

const cases: [string, NamedCase, string, string | null][] = [
  ['the pack name when there is no label', { name: 'OLL 43', label: null }, 'OLL 43', null],
  ['the label once there is one', { name: 'OLL 43', label: 'P back' }, 'P back', 'OLL 43'],
  ['the pack name for a blank label', { name: 'OLL 43', label: '' }, 'OLL 43', null],
  ['the pack name for a label of spaces', { name: 'OLL 43', label: '   ' }, 'OLL 43', null],
  ['a trimmed label', { name: 'OLL 43', label: '  P back  ' }, 'P back', 'OLL 43'],
  ['no alias when the label repeats the name', { name: 'T', label: 'T' }, 'T', null],
];

describe('caseTitle / caseAlias', () => {
  it.each(cases)('gives %s', (_name, algCase, title, alias) => {
    expect(caseTitle(algCase)).toBe(title);
    expect(caseAlias(algCase)).toBe(alias);
  });
});
