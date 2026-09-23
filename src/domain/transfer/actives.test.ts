import { describe, expect, it } from 'vitest';
import { supersededActives, type Activatable } from './actives';

interface Row extends Activatable {
  group: string;
}

function row(id: string, group: string, isActive: 0 | 1, updatedAt: number): Row {
  return { id, group, isActive, updatedAt };
}

describe('supersededActives', () => {
  it.each<[string, Row[], string[]]>([
    ['nothing', [], []],
    ['one active per group', [row('a', 'x', 1, 1), row('b', 'y', 1, 1)], []],
    ['inactive rows, however many', [row('a', 'x', 0, 1), row('b', 'x', 0, 2)], []],
    ['the older of two actives', [row('new', 'x', 1, 200), row('old', 'x', 1, 100)], ['old']],
    ['the older, whichever comes first', [row('old', 'x', 1, 100), row('new', 'x', 1, 200)], ['old']],
    ['all but the newest of three', [row('a', 'x', 1, 1), row('b', 'x', 1, 3), row('c', 'x', 1, 2)], ['a', 'c']],
    ['the higher id of an exact tie', [row('b', 'x', 1, 5), row('a', 'x', 1, 5)], ['b']],
    ['per group, not across them', [row('a', 'x', 1, 1), row('b', 'y', 1, 2), row('c', 'x', 1, 3)], ['a']],
  ])('switches off %s', (_name, rows, expected) => {
    expect(supersededActives(rows, (entry) => entry.group).sort()).toEqual(expected);
  });
});
