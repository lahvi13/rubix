import { describe, expect, it } from 'vitest';
import { pbSingle } from './pb';

describe('pbSingle', () => {
  it.each<[string, (number | null)[], number | null]>([
    ['empty history', [], null],
    ['all DNF', [null, null], null],
    ['minimum of counting times', [12_000, 9990, null, 10_500], 9990],
    ['single solve', [8000], 8000],
    ['ties keep the value', [7000, 7000], 7000],
  ])('%s', (_name, finals, expected) => {
    expect(pbSingle(finals)).toBe(expected);
  });
});
