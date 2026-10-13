import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUZZLE,
  SUPPORTED_PUZZLES,
  defaultMethodFor,
  repairedMethodFor,
  repairedSessionRow,
  supportedPuzzle,
} from './puzzles';

describe('supportedPuzzle', () => {
  it.each([
    ['333', '333'],
    ['222', '222'],
    // Known to the data model, not yet to any screen.
    ['444', DEFAULT_PUZZLE],
    ['', DEFAULT_PUZZLE],
    ['nonsense', DEFAULT_PUZZLE],
  ])('reads %j as %j', (stored, expected) => {
    expect(supportedPuzzle(stored)).toBe(expected);
  });
});

describe('defaultMethodFor', () => {
  it('keeps CFOP for the 3×3', () => {
    expect(defaultMethodFor('333')).toBe('cfop');
  });

  it('gives every other puzzle a method of its own', () => {
    expect(defaultMethodFor('222')).toBe('222');
    expect(defaultMethodFor('pyram')).toBe('pyram');
  });
});

describe('repairedMethodFor', () => {
  it.each([
    ['333', 'cfop', 'cfop'],
    ['333', 'roux', 'roux'],
    ['222', 'cfop', '222'],
    ['222', '222', '222'],
    // Somebody's own method for the puzzle is theirs to keep.
    ['222', 'ortega', 'ortega'],
    ['pyram', 'cfop', 'pyram'],
  ] as const)('a %s session timed in %s belongs to %s', (puzzle, methodId, expected) => {
    expect(repairedMethodFor(puzzle, methodId)).toBe(expected);
  });
});

describe('repairedSessionRow', () => {
  it('agrees with repairedMethodFor', () => {
    expect(repairedSessionRow({ id: 'a', puzzle: '222', methodId: 'cfop' })).toEqual({
      id: 'a',
      puzzle: '222',
      methodId: repairedMethodFor('222', 'cfop'),
    });
  });

  it.each([
    [{ id: 'a', puzzle: '333', methodId: 'cfop' }],
    [{ id: 'a', puzzle: '222', methodId: '222' }],
    // Not a session at all: left for the validator to refuse.
    [{ id: 'a' }],
    [{ puzzle: 7, methodId: 'cfop' }],
  ])('leaves %j as it is', (row) => {
    expect(repairedSessionRow(row)).toEqual(row);
  });
});

describe('SUPPORTED_PUZZLES', () => {
  it('opens on the default', () => {
    expect(SUPPORTED_PUZZLES[0]).toBe(DEFAULT_PUZZLE);
  });
});
