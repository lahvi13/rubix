import { describe, expect, it } from 'vitest';
import { solvesInScope } from './scope';

// Oldest first; the id says where each solve stands and what it carries.
const SOLVES = [
  { id: '1', tagIds: ['oh'] },
  { id: '2', tagIds: [] },
  { id: '3', tagIds: ['oh', 'warmup'] },
  { id: '4', tagIds: ['warmup'] },
  { id: '5', tagIds: ['oh'] },
];

const ids = (solves: readonly { id: string }[]) => solves.map((solve) => solve.id);

describe('solvesInScope', () => {
  it.each<[string, string | null, number | null, string[], string[]]>([
    ['everything', null, null, ['1', '2', '3', '4', '5'], ['1', '2', '3', '4', '5']],
    ['the latest two', null, 2, ['1', '2', '3', '4', '5'], ['4', '5']],
    ['one tag', 'oh', null, ['1', '3', '5'], ['1', '3', '5']],
    // Tag first: the latest two tagged solves, not the tagged among the latest two.
    ['the latest two of a tag', 'oh', 2, ['1', '3', '5'], ['3', '5']],
    ['more than there are', 'warmup', 100, ['3', '4'], ['3', '4']],
    ['a tag nothing carries', 'gone', null, [], []],
  ])('%s', (_, tagId, latest, pool, read) => {
    const scoped = solvesInScope(SOLVES, tagId, latest);

    expect(ids(scoped.pool)).toEqual(pool);
    expect(ids(scoped.read)).toEqual(read);
  });

  it('is empty over no solves', () => {
    expect(solvesInScope([], 'oh', 100)).toEqual({ pool: [], read: [] });
  });
});
