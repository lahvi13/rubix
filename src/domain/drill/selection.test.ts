import { describe, expect, it } from 'vitest';
import { drillPool, pickFrom, pickNextCase } from './selection';
import type { Random } from '../../lib/random';

/** A random source that hands out exactly the values a test names. */
function sequence(...values: number[]): Random {
  let index = 0;
  return () => values[index++] ?? 0;
}

const cases = [{ id: 'pll-t' }, { id: 'pll-y' }, { id: 'pll-h' }];

describe('pickFrom', () => {
  it.each<[number, string]>([
    [0, 'pll-t'],
    [0.34, 'pll-y'],
    [0.99, 'pll-h'],
    // A source that returns 1 is out of spec, but must not index past the end.
    [1, 'pll-h'],
  ])('random %f picks %s', (value, expected) => {
    expect(pickFrom(cases, () => value)?.id).toBe(expected);
  });

  it('has nothing to pick from an empty list', () => {
    expect(pickFrom([], () => 0)).toBeUndefined();
  });
});

describe('pickNextCase', () => {
  it('never repeats the case just drilled', () => {
    // Without the exclusion, random 0 would give pll-t straight back.
    expect(pickNextCase(cases, 'pll-t', sequence(0))?.id).toBe('pll-y');
  });

  it('picks from the whole pool when nothing came before', () => {
    expect(pickNextCase(cases, null, sequence(0))?.id).toBe('pll-t');
  });

  it('repeats the only case in a pool of one', () => {
    expect(pickNextCase([{ id: 'pll-t' }], 'pll-t', sequence(0))?.id).toBe('pll-t');
  });

  it('ignores a previous case that is no longer in the pool', () => {
    expect(pickNextCase(cases, 'oll-27', sequence(0.99))?.id).toBe('pll-h');
  });

  it('has nothing to pick from an empty pool', () => {
    expect(pickNextCase([], null, sequence(0))).toBeNull();
  });

  const weighted = [
    { id: 'pll-t', weight: 1 },
    { id: 'pll-y', weight: 3 },
    { id: 'pll-h', weight: 0.5 },
  ];

  it.each<[number, string]>([
    // 4.5 in all: pll-t takes [0, 1), pll-y [1, 4), pll-h [4, 4.5).
    [0, 'pll-t'],
    [0.2, 'pll-t'],
    [0.23, 'pll-y'],
    [0.88, 'pll-y'],
    [0.9, 'pll-h'],
    [1, 'pll-h'],
  ])('gives each case a share of the draw as wide as its weight: random %f picks %s', (value, expected) => {
    expect(pickNextCase(weighted, null, sequence(value))?.id).toBe(expected);
  });

  it('shares the draw among the rest when the case just drilled is left out', () => {
    // Without pll-y: 1.5 in all, pll-t [0, 1), pll-h [1, 1.5).
    expect(pickNextCase(weighted, 'pll-y', sequence(0.7))?.id).toBe('pll-h');
  });

  it('draws evenly when every weight is zero, rather than never', () => {
    const none = cases.map((entry) => ({ ...entry, weight: 0 }));
    expect(pickNextCase(none, null, sequence(0.99))?.id).toBe('pll-h');
  });
});

describe('drillPool', () => {
  it('drills the whole set when nothing is selected', () => {
    expect(drillPool(cases, null)).toEqual(cases);
    expect(drillPool(cases, [])).toEqual(cases);
  });

  it('keeps the selected cases in set order', () => {
    expect(drillPool(cases, ['pll-h', 'pll-t']).map((entry) => entry.id)).toEqual([
      'pll-t',
      'pll-h',
    ]);
  });

  it('falls back to the set when the selection matches nothing', () => {
    expect(drillPool(cases, ['gone'])).toEqual(cases);
  });
});
