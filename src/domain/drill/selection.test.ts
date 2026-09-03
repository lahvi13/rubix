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
