import { describe, expect, it } from 'vitest';
import { packAlgId, packAlgKind, setsByMethod, withTwin, type PackAlgKind } from './sets';

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

describe('setsByMethod', () => {
  const set = (id: string, methodId: string) => ({ id, methodId });
  const shape = (sets: { id: string; methodId: string }[]) =>
    setsByMethod(sets).map((row) => [row.methodId, row.sets.map((entry) => entry.id)]);

  it.each([
    ['nothing', [], []],
    ['one method', [set('f2l', 'cfop'), set('oll', 'cfop')], [['cfop', ['f2l', 'oll']]]],
    [
      'two methods, each in the order its sets came',
      [set('f2l', 'cfop'), set('oll', 'cfop'), set('sb', 'roux'), set('cmll', 'roux')],
      [
        ['cfop', ['f2l', 'oll']],
        ['roux', ['sb', 'cmll']],
      ],
    ],
    [
      // The methods stand in the order their first set comes, and a set that
      // turns up later still joins its own row.
      'a method whose sets are apart',
      [set('f2l', 'cfop'), set('sb', 'roux'), set('pll', 'cfop')],
      [
        ['cfop', ['f2l', 'pll']],
        ['roux', ['sb']],
      ],
    ],
  ])('lays out %s', (_, sets, expected) => {
    expect(shape(sets)).toEqual(expected);
  });

  it('leaves the list it was given as it was', () => {
    const sets = Object.freeze([Object.freeze(set('f2l', 'cfop')), Object.freeze(set('sb', 'roux'))]);
    expect(setsByMethod(sets)).toHaveLength(2);
  });
});
