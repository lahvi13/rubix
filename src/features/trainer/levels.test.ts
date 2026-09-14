import { describe, expect, it } from 'vitest';
import { entryOf, withLastLevel } from './levels';

describe('entryOf', () => {
  it.each([
    ['a set with no level looked at yet opens on itself', 'f2l', [], 'f2l'],
    ['a set opens on its last level', 'f2l', ['f2l-advanced'], 'f2l-advanced'],
    ['the basic level counts as a level looked at', 'f2l', ['f2l'], 'f2l'],
    ['another set’s level is not this set’s', 'oll', ['f2l-expert'], 'oll'],
  ] as const)('%s', (_label, setId, lastLevels, expected) => {
    expect(entryOf(setId, lastLevels)).toBe(expected);
  });
});

describe('withLastLevel', () => {
  it.each([
    ['records the first level looked at', [], 'f2l-advanced', ['f2l-advanced']],
    // One per set: looking at another level of the same set replaces the old one.
    ['replaces the level of the same set', ['f2l-advanced'], 'f2l-expert', ['f2l-expert']],
    ['going back to basic replaces it too', ['f2l-expert'], 'f2l', ['f2l']],
  ] as const)('%s', (_label, lastLevels, levelId, expected) => {
    expect(withLastLevel(lastLevels, levelId)).toEqual(expected);
  });
});
