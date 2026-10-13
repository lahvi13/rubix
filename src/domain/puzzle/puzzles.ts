import type { Puzzle } from '../../db/types';
import type { CubeOrder } from '../cube/views';

/**
 * The cubes the app can be switched to, in the order the switch lists them.
 * `Puzzle` is wider on purpose: a csTimer import keeps a pyraminx session as
 * what it was, and no screen shows it until its puzzle joins this list.
 */
export type SupportedPuzzle = Extract<Puzzle, '333' | '222'>;

export const SUPPORTED_PUZZLES: readonly SupportedPuzzle[] = ['333', '222'];

export const DEFAULT_PUZZLE: SupportedPuzzle = '333';

/** What is stored is whatever some version of the app wrote, a later one included. */
export function supportedPuzzle(stored: string): SupportedPuzzle {
  return SUPPORTED_PUZZLES.find((puzzle) => puzzle === stored) ?? DEFAULT_PUZZLE;
}

const CUBE_METHOD_ID = 'cfop';

/**
 * The method a session of the puzzle is timed in until somebody says
 * otherwise. Only the 3×3 has methods to choose between; every other puzzle
 * has one, named after itself and without phases — its solves are over before
 * a phase could be tapped.
 */
export function defaultMethodFor(puzzle: Puzzle): string {
  return puzzle === '333' ? CUBE_METHOD_ID : puzzle;
}

/**
 * What a session's method should have been. Until the app could be switched
 * to another cube, every session was written with the 3×3's default, a 2×2
 * session out of csTimer included — which would now offer it CFOP's phases.
 * A method of its own puzzle is left alone.
 */
export function repairedMethodFor(puzzle: Puzzle, methodId: string): string {
  return puzzle !== '333' && methodId === CUBE_METHOD_ID ? defaultMethodFor(puzzle) : methodId;
}

/** The same repair for a row out of a backup, which is not yet known to be a session. */
export function repairedSessionRow(row: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { puzzle, methodId } = row;
  if (typeof puzzle !== 'string' || puzzle === '333' || methodId !== CUBE_METHOD_ID) {
    return { ...row };
  }
  // The method is named after the puzzle; see defaultMethodFor.
  return { ...row, methodId: puzzle };
}

/** Cubies along an edge, for the app's own pictures of each cube. */
export const CUBE_ORDER: Readonly<Record<SupportedPuzzle, CubeOrder>> = {
  '333': 3,
  '222': 2,
};

/** How cubing.js names each puzzle, for a player that turns it. */
export const TWISTY_PUZZLE: Readonly<Record<SupportedPuzzle, string>> = {
  '333': '3x3x3',
  '222': '2x2x2',
};
