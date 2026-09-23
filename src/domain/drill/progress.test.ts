import { describe, expect, it } from 'vitest';
import type { CaseProgress } from '../../db/types';
import { countProgress } from './progress';

describe('countProgress', () => {
  it.each<[string, CaseProgress[], [number, number, number, number]]>([
    ['an empty set', [], [0, 0, 0, 0]],
    ['a set not started', ['new', 'new'], [2, 0, 0, 2]],
    ['a set under way', ['known', 'learning', 'new', 'known'], [1, 1, 2, 4]],
    ['a set learned', ['known', 'known', 'known'], [0, 0, 3, 3]],
  ])('counts %s', (_name, progress, [fresh, learning, known, total]) => {
    expect(countProgress(progress)).toEqual({ new: fresh, learning, known, total });
  });
});
