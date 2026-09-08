import { describe, expect, it } from 'vitest';
import type { Random } from '../../lib/random';
import { buildRound, OPTION_COUNT, type RecognitionCase } from './round';

/** A source that hands out the numbers it was given, then zeroes. */
function sequence(values: readonly number[]): Random {
  let index = 0;
  return () => values[index++] ?? 0;
}

function makeCases(count: number, group: string | null): RecognitionCase[] {
  return Array.from({ length: count }, (_unused, index) => ({ id: `c${index}`, group }));
}

const oll: RecognitionCase[] = [
  { id: 'p1', group: 'P' },
  { id: 'p2', group: 'P' },
  { id: 'p3', group: 'P' },
  { id: 'p4', group: 'P' },
  { id: 'f1', group: 'Fish' },
  { id: 'f2', group: 'Fish' },
  { id: 'l1', group: null },
  { id: 'l2', group: null },
];

describe('buildRound', () => {
  it.each([
    ['an empty pool', []],
    ['a single case', makeCases(1, 'P')],
  ])('has no question to ask for %s', (_name, pool) => {
    expect(buildRound(pool, null, Math.random)).toBeNull();
  });

  it('offers as many cards as there are cases when the pool is small', () => {
    const round = buildRound(makeCases(3, 'P'), null, Math.random);
    expect(round?.optionIds).toHaveLength(3);
  });

  it('offers OPTION_COUNT cards once the pool is big enough', () => {
    const round = buildRound(makeCases(20, 'P'), null, Math.random);
    expect(round?.optionIds).toHaveLength(OPTION_COUNT);
  });

  it('always offers the answer, exactly once', () => {
    for (let seed = 0; seed < 200; seed++) {
      const round = buildRound(oll, null, Math.random);
      expect(round).not.toBeNull();
      const matches = round?.optionIds.filter((id) => id === round.answerId) ?? [];
      expect(matches).toHaveLength(1);
    }
  });

  it('never offers the same card twice', () => {
    for (let seed = 0; seed < 200; seed++) {
      const round = buildRound(oll, null, Math.random);
      const ids = round?.optionIds ?? [];
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('fills the cards from the answer\'s own family first', () => {
    // Four cards from a pool where the answer has three family members: the
    // family fills every distractor slot before anything else is reached.
    for (let seed = 0; seed < 200; seed++) {
      const round = buildRound(oll, null, Math.random, 4);
      const answer = oll.find((entry) => entry.id === round?.answerId);
      if (answer?.group !== 'P') continue;

      const groups = (round?.optionIds ?? []).map(
        (id) => oll.find((entry) => entry.id === id)?.group,
      );
      expect(groups).toEqual(['P', 'P', 'P', 'P']);
    }
  });

  it('reaches outside the family when the family is too small', () => {
    const round = buildRound(oll, null, sequence([0.5]), OPTION_COUNT);
    expect(round?.optionIds).toHaveLength(OPTION_COUNT);
  });

  it('does not ask the same case twice in a row', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(buildRound(oll, 'p1', Math.random)?.answerId).not.toBe('p1');
    }
  });

  it('asks the only case again rather than nothing, when the pool is two', () => {
    // Two cases and one of them just came up: the alternative to repeating is
    // an empty screen, and the pool is the user's own choice.
    const round = buildRound(makeCases(2, 'P'), 'c0', Math.random);
    expect(round?.answerId).toBe('c1');
  });
});
