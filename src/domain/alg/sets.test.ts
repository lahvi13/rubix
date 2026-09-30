import { describe, expect, it } from 'vitest';
import { packAlgId, packAlgKind, withTwin, type PackAlgKind } from './sets';

describe('packAlgId and packAlgKind', () => {
  it.each<[PackAlgKind, number, string]>([
    ['main', 0, 'pll-t-pack'],
    ['grip', 0, 'pll-t-pack-grip'],
    ['other', 0, 'pll-t-pack-other-1'],
    ['other', 2, 'pll-t-pack-other-3'],
    ['slot', 0, 'pll-t-pack-slot-1'],
    ['orient', 1, 'pll-t-pack-orient-2'],
  ])('%s #%i is %s, and reads back as the same kind', (kind, index, id) => {
    expect(packAlgId('pll-t', kind, index)).toBe(id);
    expect(packAlgKind(id)).toBe(kind);
  });
});

describe('withTwin', () => {
  it.each([
    ['2pll-t', ['2pll-t', 'pll-t']],
    ['pll-t', ['2pll-t', 'pll-t']],
    ['oll-27', ['2oll-sune', 'oll-27']],
    // A first-look edge shape is not the same case as any full OLL.
    ['2oll-line', ['2oll-line']],
    ['pll-na', ['pll-na']],
  ])('%s -> %j', (caseId, expected) => {
    expect(withTwin(caseId)).toEqual(expected);
  });
});
