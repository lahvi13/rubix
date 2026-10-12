import { describe, expect, it } from 'vitest';
import { parseAlg, type Move } from '../cube/notation';
import { isLeftHanded } from './hand';

function movesOf(text: string): Move[] {
  const parsed = parseAlg(text);
  if (!parsed.ok) throw new Error(`unparsable: ${text}`);
  return parsed.moves;
}

describe('isLeftHanded', () => {
  it.each([
    ['a one-handed CMLL for the left hand', "(U2) L' U2 L U L' U2 z' U z U' L U L' x'", true],
    ['a mirrored F2L insert', "y (L' U2 L) U (L' U' L)", true],
    ['a wide left turn', "l' U' L U l", true],
    ['the same case for the right hand', "R U2 R' U' R U2 z U' z' U R' U' z U z'", false],
    ['an algorithm that uses both sides', "L' U R U' L U' R' U' R U' R'", false],
    ['nothing but the middle slice and the top', "M' U M U' M' U' M'", false],
    ['no moves at all', '', false],
  ])('%s', (_label, alg, expected) => {
    expect(isLeftHanded(movesOf(alg))).toBe(expected);
  });
});
