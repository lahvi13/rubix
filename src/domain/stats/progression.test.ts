import { describe, expect, it } from 'vitest';
import { recordProgression, type RecordStep } from './progression';

describe('recordProgression', () => {
  it.each<[string, (number | null)[], RecordStep[]]>([
    ['has no records without values', [], []],
    ['has no records over DNFs alone', [null, null], []],
    ['starts with the first value, which beat nothing', [12_000], [{ index: 0, ms: 12_000, previousMs: null }]],
    [
      'keeps only the values faster than all before them',
      [12_000, 13_000, 11_000, 11_500, 9000],
      [
        { index: 0, ms: 12_000, previousMs: null },
        { index: 2, ms: 11_000, previousMs: 12_000 },
        { index: 4, ms: 9000, previousMs: 11_000 },
      ],
    ],
    ['does not count a tie as a record', [10_000, 10_000], [{ index: 0, ms: 10_000, previousMs: null }]],
    [
      'lets a DNF or a missing average set nothing',
      [null, 12_000, null, 11_000],
      [
        { index: 1, ms: 12_000, previousMs: null },
        { index: 3, ms: 11_000, previousMs: 12_000 },
      ],
    ],
  ])('%s', (_name, values, expected) => {
    expect(recordProgression(values)).toEqual(expected);
  });
});
